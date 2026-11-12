import "server-only";
import { decrypt } from "./crypto";
import { db } from "./db";
import { BRAND, SITE_URL, getConnections, getSite } from "./settings";

// Alle e-mails van de site (bestelmails, formuliermeldingen, bevestigingen) lopen via SparkPost (Transmissions API).
// Elke poging komt in het verzendlog (MailLog): "verstuurd", "gebounced", "mislukt" of "niet ingesteld" (SparkPost
// staat uit of heeft geen sleutel: er is dan niets verstuurd). sendMail gooit nooit een fout.

const API = { us: "https://api.sparkpost.com/api/v1", eu: "https://api.eu.sparkpost.com/api/v1" } as const;

/** `html` is optioneel: een volledig document (<!doctype …>/<html>) gaat ongewijzigd mee, een fragment krijgt de huisstijl eromheen. */
export type Mail = { to: string | string[]; subject: string; text: string; html?: string; replyTo?: string };
export type MailResult = { sent: true } | { sent: false; reason: string };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Huisstijl-omslag voor e-mails: marineblauwe kop, witte kaart, Arial. `inner` is HTML. */
export function mailLayout(inner: string, footer = "") {
  return `<!doctype html><html lang="nl"><body style="margin:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#0A1A33"><div style="max-width:600px;margin:0 auto;padding:24px 16px"><div style="background:#0A1A33;border-radius:12px 12px 0 0;padding:20px 28px"><a href="${SITE_URL}/" style="font-size:20px;font-weight:bold;color:#ffffff;text-decoration:none;letter-spacing:.3px">${esc(BRAND)}</a></div><div style="background:#ffffff;border:1px solid #dbe3ee;border-top:3px solid #0050B0;border-radius:0 0 12px 12px;padding:28px;font-size:15px;line-height:1.6">${inner}</div><p style="font-size:12px;line-height:1.5;color:#5b6b85;margin:16px 4px 0">${footer || esc(BRAND)}</p></div></body></html>`;
}

/** Platte tekst → HTML in huisstijl (alinea's en regeleinden blijven behouden, links worden klikbaar). */
function toHtml(text: string) {
  return esc(text)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${p.replace(/\n/g, "<br>").replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#0050B0">$1</a>')}</p>`)
    .join("");
}

async function log(to: string, subject: string, status: string, extra: { error?: string; providerId?: string | null } = {}) {
  try {
    await db.mailLog.create({ data: { to: to.slice(0, 500) || "–", subject: subject.slice(0, 300), status, error: extra.error?.slice(0, 500), providerId: extra.providerId ?? null } });
  } catch {
    /* het log mag het versturen nooit breken */
  }
}

export async function sendMail(mail: Mail, opts: { force?: boolean } = {}): Promise<MailResult> {
  const c = (await getConnections()).sparkpost;
  const all = (Array.isArray(mail.to) ? mail.to : mail.to.split(/[,;\s]+/)).map((a) => a.trim()).filter(Boolean);
  const to = all.filter((a) => /^\S+@\S+\.\S+$/.test(a));
  if ((!c.enabled && !opts.force) || !c.keyEnc) {
    await log(all.join(", "), mail.subject, "niet ingesteld");
    return { sent: false, reason: "SparkPost is niet ingesteld" };
  }
  if (!to.length) {
    await log(all.join(", "), mail.subject, "mislukt", { error: "Geen geldig e-mailadres" });
    return { sent: false, reason: "Geen geldig e-mailadres" };
  }
  try {
    const site = await getSite();
    const footer = [site.legalName || site.name, [site.street, [site.postalCode, site.city].filter(Boolean).join(" ")].filter(Boolean).join(", "), site.email, site.phone].filter(Boolean).map(esc).join(" · ");
    const html = mail.html ? (/^\s*<(!doctype|html)/i.test(mail.html) ? mail.html : mailLayout(mail.html, footer)) : mailLayout(toHtml(mail.text), footer);
    const res = await fetch(`${API[c.region]}/transmissions`, {
      method: "POST",
      headers: { Authorization: decrypt(c.keyEnc), "Content-Type": "application/json" },
      body: JSON.stringify({
        options: { transactional: true, open_tracking: false, click_tracking: false },
        recipients: to.map((address) => ({ address })),
        content: { from: { email: c.fromEmail, name: c.fromName || BRAND }, reply_to: mail.replyTo || c.replyTo || undefined, subject: mail.subject, text: mail.text, html },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => null)) as { results?: { id?: string; total_rejected_recipients?: number }; errors?: { message?: string; description?: string }[] } | null;
    if (!res.ok) throw new Error(`SparkPost ${res.status}: ${data?.errors?.[0]?.description || data?.errors?.[0]?.message || res.statusText}`);
    const bounced = (data?.results?.total_rejected_recipients ?? 0) > 0;
    await log(to.join(", "), mail.subject, bounced ? "gebounced" : "verstuurd", { providerId: data?.results?.id });
    return { sent: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await log(to.join(", "), mail.subject, "mislukt", { error: message });
    return { sent: false, reason: message };
  }
}

/** SparkPost-sleutel controleren zonder te mailen, plus de status van het verzenddomein (SPF/DKIM). */
export async function testSparkpost(keyEnc: string, region: "us" | "eu", fromEmail: string) {
  const headers = { Authorization: decrypt(keyEnc) };
  const res = await fetch(`${API[region]}/account`, { headers, signal: AbortSignal.timeout(10_000) });
  if (res.status === 401 || res.status === 403) throw new Error("De API-sleutel wordt niet geaccepteerd (controleer sleutel, rechten en regio EU/US).");
  if (!res.ok) throw new Error(`SparkPost gaf status ${res.status}.`);
  const domain = fromEmail.split("@")[1];
  let domainStatus = "onbekend";
  if (domain) {
    const d = await fetch(`${API[region]}/sending-domains/${domain}`, { headers, signal: AbortSignal.timeout(10_000) });
    if (d.ok) {
      const s = ((await d.json()) as { results?: { status?: { ownership_verified?: boolean; spf_status?: string; dkim_status?: string } } }).results?.status;
      domainStatus = `${domain}: eigendom ${s?.ownership_verified ? "geverifieerd" : "niet geverifieerd"}, SPF ${s?.spf_status ?? "?"}, DKIM ${s?.dkim_status ?? "?"}`;
    } else domainStatus = `${domain}: niet gevonden als verzenddomein in SparkPost`;
  }
  return { message: "Verbonden met SparkPost.", domainStatus };
}

export const fill = (tpl: string, vars: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
