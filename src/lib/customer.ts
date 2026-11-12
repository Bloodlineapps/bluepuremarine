import "server-only";
import { createHash } from "node:crypto";
import { cache } from "react";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { OrderAddress } from "@/components/shop/order-status";
import { db } from "./db";

// Klantaccounts van de webshop. Volledig gescheiden van het beheer: eigen cookie, eigen ondertekeningssleutel
// (afgeleid van AUTH_SECRET met een ander voorvoegsel) en een eigen claim `typ: "customer"`. Een beheer-token werkt
// hier dus nooit en een klant-token nooit in het beheer.

export const CUSTOMER_COOKIE = "bpm_customer";
/** Leesbare cookie met alleen de voornaam, voor "Hallo <naam>" in de header (geen rechten aan verbonden). */
export const CUSTOMER_NAME_COOKIE = "bpm_customer_n";
const DAYS = 30;

let ephemeral: Uint8Array | null = null;
function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production") return (ephemeral ??= crypto.getRandomValues(new Uint8Array(32)));
    return new Uint8Array(createHash("sha256").update("bpm-customer:dev-only-secret-please-change-me-0123456789").digest());
  }
  return new Uint8Array(createHash("sha256").update(`bpm-customer:${s}`).digest());
}

/** Korte vingerafdruk van het wachtwoord: na een wachtwoordwijziging vervallen alle oude sessies. */
const stamp = (passwordHash: string) => createHash("sha256").update(passwordHash).digest("hex").slice(0, 16);

export type CurrentCustomer = { id: string; email: string; firstName: string; lastName: string; phone: string; newsletter: boolean };

const cookieOpts = (httpOnly: boolean) => ({ httpOnly, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: DAYS * 86400 });

export async function startCustomerSession(customer: { id: string; firstName: string; passwordHash: string }) {
  const token = await new SignJWT({ typ: "customer", v: stamp(customer.passwordHash) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(customer.id)
    .setAudience("bpm-customer")
    .setIssuedAt()
    .setExpirationTime(`${DAYS}d`)
    .sign(secret());
  const store = await cookies();
  store.set(CUSTOMER_COOKIE, token, cookieOpts(true));
  store.set(CUSTOMER_NAME_COOKIE, encodeURIComponent(customer.firstName.slice(0, 40)), cookieOpts(false));
}

export async function endCustomerSession() {
  const store = await cookies();
  store.delete(CUSTOMER_COOKIE);
  store.delete(CUSTOMER_NAME_COOKIE);
}

/** De ingelogde klant, of null. Gegevens komen altijd vers uit de database. */
export const currentCustomer = cache(async (): Promise<CurrentCustomer | null> => {
  const token = (await cookies()).get(CUSTOMER_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"], audience: "bpm-customer" });
    if (payload.typ !== "customer" || !payload.sub) return null;
    const c = await db.customer.findUnique({ where: { id: payload.sub } });
    if (!c || payload.v !== stamp(c.passwordHash)) return null;
    return { id: c.id, email: c.email, firstName: c.firstName, lastName: c.lastName, phone: c.phone, newsletter: c.newsletter };
  } catch {
    return null;
  }
});

/** Voor accountpagina's: niet ingelogd → naar de inlogpagina, met de pagina waar je vandaan kwam. */
export async function requireCustomer(terug = "/account/") {
  const customer = await currentCustomer();
  if (!customer) redirect(`/account/inloggen/?terug=${encodeURIComponent(terug)}`);
  return customer;
}

/** Alleen interne paden toestaan als terugkeeradres (geen open redirect). */
export const safeReturn = (terug: string | null | undefined, fallback = "/account/") => (terug && /^\/(?!\/)[A-Za-z0-9\-_/?=&%.]*$/.test(terug) && !terug.startsWith("/admin") ? terug : fallback);

// ---------- adresvalidatie (checkout en adresboek) ----------

export const ADDRESS_FIELDS = ["firstName", "lastName", "company", "country", "postalCode", "houseNumber", "addition", "street", "city"] as const;

const text = (max: number, required: string) => z.string().trim().min(1, required).max(max, `Maximaal ${max} tekens`);

/** Postcode per land controleren en in de gangbare schrijfwijze zetten (NL: "1234 AB"). null = ongeldig. */
export function normalizePostalCode(country: string, input: string) {
  const v = input.trim().toUpperCase();
  if (country === "NL") {
    const m = /^([1-9]\d{3})\s?([A-Z]{2})$/.exec(v);
    return m ? `${m[1]} ${m[2]}` : null;
  }
  if (country === "BE") return /^[1-9]\d{3}$/.test(v) ? v : null;
  if (country === "DE") return /^\d{5}$/.test(v) ? v : null;
  return /^[A-Z0-9][A-Z0-9 \-]{2,9}$/.test(v) ? v : null;
}

const POSTAL_HINT: Record<string, string> = { NL: "Vul een geldige postcode in, bv. 1234 AB", BE: "Vul een geldige Belgische postcode in (4 cijfers)", DE: "Vul een geldige Duitse postcode in (5 cijfers)" };

const addressSchema = z.object({
  firstName: text(60, "Vul je voornaam in"),
  lastName: text(80, "Vul je achternaam in"),
  company: z.string().trim().max(100, "Maximaal 100 tekens"),
  country: z.string().trim().toUpperCase(),
  postalCode: z.string().trim().min(1, "Vul je postcode in").max(12),
  houseNumber: z.string().trim().min(1, "Vul je huisnummer in").max(10).regex(/^[1-9]\d{0,4}/, "Het huisnummer begint met een cijfer"),
  addition: z.string().trim().max(12, "Maximaal 12 tekens"),
  street: text(100, "Vul je straat in"),
  city: text(80, "Vul je plaats in"),
});

export type AddressResult = { ok: true; data: OrderAddress } | { ok: false; errors: Record<string, string> };

/**
 * Adres uit een formulier controleren. `prefix` is het voorvoegsel van de veldnamen (bv. "b_" voor het factuuradres);
 * fouten komen terug onder dezelfde veldnamen. `countries` zijn de landen waar de winkel naartoe verzendt.
 */
export function parseAddress(form: FormData | Record<string, string>, countries: string[], prefix = ""): AddressResult {
  const get = (k: string) => String((form instanceof FormData ? form.get(prefix + k) : form[prefix + k]) ?? "");
  const raw = Object.fromEntries(ADDRESS_FIELDS.map((k) => [k, get(k)]));
  // Huisnummer met toevoeging in één veld ("12A", "12 bis") netjes splitsen
  // (?!\d): het hele getal is het huisnummer; zonder dit werd "22" gesplitst in huisnummer 2 met toevoeging 2
  const hn = /^(\d{1,5})(?!\d)\s*[-/ ]?\s*(\S.*)$/.exec(raw.houseNumber.trim());
  if (hn && !raw.addition.trim()) {
    raw.houseNumber = hn[1];
    raw.addition = hn[2];
  }
  const parsed = addressSchema.safeParse(raw);
  const errors: Record<string, string> = {};
  if (!parsed.success) for (const issue of parsed.error.issues) errors[prefix + String(issue.path[0])] ??= issue.message;
  const country = raw.country.trim().toUpperCase();
  if (!countries.includes(country)) errors[prefix + "country"] ??= "Kies een land waar we naartoe verzenden";
  else if (!errors[prefix + "postalCode"]) {
    const pc = normalizePostalCode(country, raw.postalCode);
    if (!pc) errors[prefix + "postalCode"] = POSTAL_HINT[country] ?? "Vul een geldige postcode in";
    else if (parsed.success) parsed.data.postalCode = pc;
  }
  if (!parsed.success || Object.keys(errors).length) return { ok: false, errors };
  const d = parsed.data;
  return { ok: true, data: { ...d, houseNumber: /^\d+/.exec(d.houseNumber)![0], addition: d.addition || d.houseNumber.replace(/^\d+\s*/, ""), country } };
}

export const emailSchema = z.string().trim().toLowerCase().min(5, "Vul je e-mailadres in").max(160, "Dit e-mailadres is te lang").email("Vul een geldig e-mailadres in");
export const passwordSchema = z.string().min(8, "Kies een wachtwoord van minimaal 8 tekens").max(200, "Dit wachtwoord is te lang");
export const phoneSchema = z.string().trim().max(30, "Dit telefoonnummer is te lang").regex(/^$|^[+0-9][0-9 ()\-.]{5,}$/, "Vul een geldig telefoonnummer in");

export const BCRYPT_COST = 11;
/** Vaste hash om ook bij een onbekend e-mailadres te vergelijken (geen timing-verschil). */
export const DUMMY_HASH = "$2a$11$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva";
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
