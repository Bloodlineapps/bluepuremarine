import "server-only";
import { headers } from "next/headers";
import { decrypt } from "./crypto";
import { SITE_URL, getConnections } from "./settings";

// Mollie-koppeling (alleen server-side). De sleutel staat versleuteld in de connecties; er worden nooit kaart- of
// rekeninggegevens opgeslagen: de klant betaalt op de pagina van Mollie en wij bewaren alleen het betaling-id.

const API = "https://api.mollie.com/v2";

export type PaymentMode = "mollie" | "simulatie" | "overboeking";

/** De actieve Mollie-sleutel voor de gekozen modus (test/live), of "" als Mollie uit staat of de sleutel ontbreekt. */
export async function mollieKey() {
  const m = (await getConnections()).mollie;
  if (!m.enabled) return "";
  return decrypt(m.mode === "live" ? m.liveKeyEnc : m.testKeyEnc);
}

/** Hoe er nu betaald wordt: via Mollie, via de testbetaling (simulatie) of per overboeking. */
export async function paymentMode(): Promise<PaymentMode> {
  if (await mollieKey()) return "mollie";
  return (await getConnections()).mollie.simulate ? "simulatie" : "overboeking";
}

export async function simulationEnabled() {
  return (await paymentMode()) === "simulatie";
}

/** Is dit adres van buitenaf bereikbaar? Mollie weigert een webhook-URL op localhost of een intern adres. */
export function siteIsPublic(base: string = SITE_URL) {
  try {
    const u = new URL(base);
    const h = u.hostname.toLowerCase();
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    if (h === "localhost" || h === "[::1]" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".test") || h.endsWith(".internal")) return false;
    if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
    return h.includes(".");
  } catch {
    return false;
  }
}

/**
 * Het adres waarop de klant nu bestelt (bv. http://localhost:3800 of een preview-host). De klant komt na het betalen
 * hier terug; SITE_URL is altijd het productiedomein en zou een lokale testbestelling naar de live site sturen.
 */
export async function requestOrigin() {
  try {
    const h = await headers();
    const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim().toLowerCase();
    if (!/^[a-z0-9.-]+(:\d{1,5})?$|^\[[0-9a-f:]+\](:\d{1,5})?$/.test(host)) return SITE_URL;
    if (host === new URL(SITE_URL).host) return SITE_URL;
    const name = host.replace(/:\d+$/, "");
    const local = name === "localhost" || name === "[::1]" || name.startsWith("127.") || name.endsWith(".localhost");
    const proto = (h.get("x-forwarded-proto") ?? "").split(",")[0].trim() || (local ? "http" : "https");
    return `${proto === "http" ? "http" : "https"}://${host}`;
  } catch {
    return SITE_URL;
  }
}

/** Fout van de Mollie-API. `status` 0 = geen verbinding; 5xx/429 = tijdelijk (later opnieuw proberen heeft zin). */
export class MollieError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
  get temporary() {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

const amountOf = (cents: number) => ({ currency: "EUR", value: (cents / 100).toFixed(2) });

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const key = await mollieKey();
  if (!key) throw new Error("Mollie is niet ingesteld.");
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: init?.method ?? "GET",
      headers: { Authorization: `Bearer ${key}`, ...(init?.body ? { "Content-Type": "application/json" } : {}) },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new MollieError("Mollie is niet bereikbaar.", 0);
  }
  const data = (await res.json().catch(() => null)) as (T & { detail?: string; title?: string }) | null;
  if (!res.ok || !data) throw new MollieError(`Mollie ${res.status}: ${data?.detail || data?.title || res.statusText}`, res.ok ? 502 : res.status);
  return data;
}

export type MollieMethod = { id: string; name: string; image: string };

/** Betaalmethodes die Mollie voor dit bedrag aanbiedt (leeg bij een storing: de klant kiest dan bij Mollie zelf). */
export async function listMethods(amountCents: number): Promise<MollieMethod[]> {
  try {
    const a = amountOf(amountCents);
    const data = await call<{ _embedded?: { methods?: { id: string; description: string; image?: { svg?: string; size2x?: string; size1x?: string } }[] } }>(
      `/methods?amount[value]=${a.value}&amount[currency]=${a.currency}&locale=nl_NL`,
    );
    return (data._embedded?.methods ?? []).map((m) => ({ id: m.id, name: m.description, image: m.image?.svg || m.image?.size2x || m.image?.size1x || "" }));
  } catch {
    return [];
  }
}

export type MolliePayment = {
  id: string;
  /** open | pending | authorized | paid | failed | expired | canceled */
  status: string;
  method: string | null;
  amount: { value: string; currency: string };
  amountRefunded?: { value: string; currency: string };
  metadata?: { orderId?: string } | null;
  _links?: { checkout?: { href: string } };
};

/** Betaling aanmaken; geeft het betaling-id en de URL van de betaalpagina terug. */
export async function createPayment(order: { id: string; number: string; token: string; total: number }, method?: string) {
  const origin = await requestOrigin();
  const p = await call<MolliePayment>("/payments", {
    method: "POST",
    body: {
      amount: amountOf(order.total),
      description: `Bestelling ${order.number}`,
      redirectUrl: `${origin}/bestelling/?t=${order.token}`,
      // Zonder publiek adres (lokaal testen) geen webhook: de status wordt dan opgehaald als de klant terugkomt
      ...(siteIsPublic(origin) ? { webhookUrl: `${origin}/api/public/mollie/webhook` } : {}),
      metadata: { orderId: order.id },
      ...(method ? { method } : {}),
      locale: "nl_NL",
    },
  });
  const checkoutUrl = p._links?.checkout?.href;
  if (!checkoutUrl) throw new Error("Mollie gaf geen betaalpagina terug.");
  return { id: p.id, checkoutUrl };
}

export const getPayment = (id: string) => call<MolliePayment>(`/payments/${encodeURIComponent(id)}`);

export const createRefund = (paymentId: string, amountCents: number, description: string) =>
  call<{ id: string; status: string }>(`/payments/${encodeURIComponent(paymentId)}/refunds`, { method: "POST", body: { amount: amountOf(amountCents), description } });

export const centsOf = (a?: { value: string } | null) => (a ? Math.round(Number(a.value) * 100) : 0);
