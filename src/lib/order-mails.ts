import "server-only";
import type { Order, OrderItem } from "@prisma/client";
import { addressLines, PAYMENT_PROVIDER, type OrderAddress } from "@/components/shop/order-status";
import { parse } from "./json";
import { money } from "./money";
import { BRAND, SITE_URL, absUrl, getShop, getSite } from "./settings";

// E-mails rond een bestelling, in de huisstijl van BluePure Marine (marineblauw #0A1A33, blauw #0050B0), elk met
// een HTML- en een platte-tekstversie. Versturen gebeurt in src/lib/orders.ts via sendMail().

export type OrderWithItems = Order & { items: OrderItem[] };
export type OrderMailKind = "bevestiging" | "betaalinstructie" | "verzonden" | "geannuleerd" | "winkel";
export type BuiltMail = { subject: string; text: string; html: string };

const NAVY = "#0A1A33";
const BLUE = "#0050B0";
const RULE = "#DBE3EE";
const MUTED = "#5B6B85";
const FONT = "Arial,Helvetica,sans-serif";

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Kader van elke e-mail: logo als tekst, witte kaart, voettekst met de bedrijfsgegevens. */
export async function mailLayout(title: string, bodyHtml: string) {
  const site = await getSite();
  const footer = [site.name, [site.street, [site.postalCode, site.city].filter(Boolean).join(" ")].filter(Boolean).join(", "), site.phone, site.email, site.kvk ? `KvK ${site.kvk}` : "", site.vat ? `btw ${site.vat}` : ""].filter(Boolean).map(esc).join(" &middot; ");
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head><body style="margin:0;padding:0;background:#F4F7FB;font-family:${FONT};color:#24344F">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F7FB"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px">
<tr><td style="background:${NAVY};padding:22px 28px;border-radius:12px 12px 0 0"><a href="${SITE_URL}/" style="text-decoration:none;font-family:${FONT};font-size:22px;font-weight:bold;letter-spacing:0.5px;color:#FFFFFF">BLUE<span style="color:#5AA9FF">PURE</span> <span style="font-weight:normal">MARINE</span></a></td></tr>
<tr><td style="background:#FFFFFF;padding:28px;border:1px solid ${RULE};border-top:0;border-radius:0 0 12px 12px;font-size:15px;line-height:1.6">${bodyHtml}</td></tr>
<tr><td style="padding:18px 8px;font-size:12px;line-height:1.5;color:${MUTED};text-align:center">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

const h1 = (t: string) => `<h1 style="margin:0 0 14px;font-family:${FONT};font-size:22px;line-height:1.25;color:${NAVY}">${esc(t)}</h1>`;
const p = (html: string) => `<p style="margin:0 0 14px">${html}</p>`;
const button = (href: string, label: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 18px"><tr><td style="background:${BLUE};border-radius:8px"><a href="${href}" style="display:inline-block;padding:12px 22px;font-family:${FONT};font-size:15px;font-weight:bold;color:#FFFFFF;text-decoration:none">${esc(label)}</a></td></tr></table>`;
const box = (html: string) => `<div style="margin:0 0 18px;padding:14px 16px;background:#EEF5FE;border-left:4px solid ${BLUE};border-radius:6px">${html}</div>`;

const shipAddr = (o: Order) => parse<OrderAddress | null>(o.shippingAddress, null);
const billAddr = (o: Order) => parse<OrderAddress | null>(o.billingAddress, null);

function itemsHtml(o: OrderWithItems) {
  const rows = o.items
    .map(
      (i) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid ${RULE};vertical-align:top">${i.path ? `<a href="${absUrl(i.path)}" style="color:${NAVY};font-weight:bold;text-decoration:none">${esc(i.name)}</a>` : `<strong style="color:${NAVY}">${esc(i.name)}</strong>`}${i.variantName ? `<br><span style="color:${MUTED};font-size:13px">${esc(i.variantName)}</span>` : ""}${i.sku ? `<br><span style="color:${MUTED};font-size:12px">Artikelnr. ${esc(i.sku)}</span>` : ""}</td><td style="padding:10px 8px;border-bottom:1px solid ${RULE};vertical-align:top;text-align:center;white-space:nowrap">${i.quantity} &times;</td><td style="padding:10px 0;border-bottom:1px solid ${RULE};vertical-align:top;text-align:right;white-space:nowrap">${money(i.total)}</td></tr>`,
    )
    .join("");
  const line = (label: string, value: string, bold = false) =>
    `<tr><td colspan="2" style="padding:${bold ? "10px 0 4px" : "4px 0"};${bold ? `font-weight:bold;color:${NAVY};font-size:17px;` : ""}">${label}</td><td style="padding:${bold ? "10px 0 4px" : "4px 0"};text-align:right;white-space:nowrap;${bold ? `font-weight:bold;color:${NAVY};font-size:17px;` : ""}">${value}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;font-size:14px;line-height:1.45"><tr><th align="left" style="padding:0 0 8px;border-bottom:2px solid ${NAVY};color:${NAVY};font-size:13px">Artikel</th><th style="padding:0 8px 8px;border-bottom:2px solid ${NAVY};color:${NAVY};font-size:13px">Aantal</th><th align="right" style="padding:0 0 8px;border-bottom:2px solid ${NAVY};color:${NAVY};font-size:13px">Bedrag</th></tr>${rows}
<tr><td colspan="3" style="height:8px"></td></tr>
${line("Subtotaal", money(o.subtotal))}
${o.discountCode ? line(`Korting (${esc(o.discountCode)})`, o.discountAmount ? `- ${money(o.discountAmount)}` : "Gratis verzending") : ""}
${line("Verzendkosten", o.shippingCost ? money(o.shippingCost) : "Gratis")}
${line("Totaal incl. btw", money(o.total), true)}
<tr><td colspan="3" style="padding:0;color:${MUTED};font-size:12px">Waarvan btw: ${money(o.vatAmount)}</td></tr></table>`;
}

function itemsText(o: OrderWithItems) {
  return [
    ...o.items.map((i) => `${i.quantity} x ${i.name}${i.variantName ? ` (${i.variantName})` : ""}: ${money(i.total)}`),
    "",
    `Subtotaal: ${money(o.subtotal)}`,
    ...(o.discountCode ? [`Korting (${o.discountCode}): ${o.discountAmount ? `- ${money(o.discountAmount)}` : "gratis verzending"}`] : []),
    `Verzendkosten: ${o.shippingCost ? money(o.shippingCost) : "gratis"}`,
    `Totaal incl. btw: ${money(o.total)} (waarvan btw ${money(o.vatAmount)})`,
  ].join("\n");
}

function addressesHtml(o: Order) {
  const col = (title: string, lines: string[]) => `<td width="50%" style="vertical-align:top;padding:0 8px 0 0;font-size:14px;line-height:1.5"><strong style="color:${NAVY}">${title}</strong><br>${lines.map(esc).join("<br>")}</td>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px"><tr>${col("Bezorgadres", addressLines(shipAddr(o)))}${col("Factuuradres", addressLines(billAddr(o)))}</tr></table>`;
}
const addressesText = (o: Order) => `Bezorgadres:\n${addressLines(shipAddr(o)).join("\n")}\n\nFactuuradres:\n${addressLines(billAddr(o)).join("\n")}`;

async function transfer(o: Order) {
  const [shop, site] = await Promise.all([getShop(), getSite()]);
  const iban = shop.iban.trim();
  if (!iban) return { html: box(`<strong style="color:${NAVY}">Betaling</strong><br>We nemen contact met je op over de betaling van je bestelling.`), text: "Betaling: we nemen contact met je op over de betaling van je bestelling." };
  return {
    html: box(
      `<strong style="color:${NAVY}">Betalen per overboeking</strong><br>Maak ${money(o.total)} over naar <strong>${esc(iban)}</strong> t.n.v. ${esc(site.legalName || site.name)}, met als omschrijving <strong>${esc(o.number)}</strong>. Zodra je betaling binnen is, maken we je bestelling klaar voor verzending.`,
    ),
    text: `Betalen per overboeking:\nBedrag: ${money(o.total)}\nRekeningnummer: ${iban}\nTen name van: ${site.legalName || site.name}\nOmschrijving: ${o.number}\nZodra je betaling binnen is, maken we je bestelling klaar voor verzending.`,
  };
}

/** Bouwt de e-mail voor een bestelling: onderwerp, platte tekst en HTML. */
export async function orderMail(kind: OrderMailKind, o: OrderWithItems, extra: { reason?: string } = {}): Promise<BuiltMail> {
  const site = await getSite();
  const name = shipAddr(o)?.firstName || "klant";
  const url = `${SITE_URL}/bestelling/?t=${o.token}`;
  const sign = `Met vriendelijke groet,\n${site.name}`;
  const signHtml = p(`Met vriendelijke groet,<br><strong style="color:${NAVY}">${esc(site.name)}</strong>`);
  const help = `Heb je een vraag over je bestelling? Mail naar ${site.email}${site.phone ? ` of bel ${site.phone}` : ""} en vermeld bestelnummer ${o.number}.`;
  const helpHtml = p(`<span style="color:${MUTED};font-size:13px">${esc(help)}</span>`);
  const note = o.note ? { html: p(`<strong style="color:${NAVY}">Je opmerking</strong><br>${esc(o.note).replace(/\n/g, "<br>")}`), text: `Je opmerking: ${o.note}\n\n` } : { html: "", text: "" };

  if (kind === "bevestiging" || kind === "betaalinstructie") {
    const pay = kind === "betaalinstructie" ? await transfer(o) : null;
    const subject = kind === "betaalinstructie" ? `Je bestelling ${o.number} bij ${BRAND}: betaalinstructie` : `Bedankt voor je bestelling ${o.number} bij ${BRAND}`;
    const intro = kind === "betaalinstructie" ? `Bedankt voor je bestelling. We hebben hem ontvangen onder nummer ${o.number} en wachten nog op je betaling.` : `Bedankt voor je bestelling. Je betaling is ontvangen en we gaan ermee aan de slag. Je bestelnummer is ${o.number}.`;
    const html = await mailLayout(
      subject,
      `${h1(kind === "betaalinstructie" ? "We hebben je bestelling ontvangen" : "Bedankt voor je bestelling")}${p(`Hallo ${esc(name)},`)}${p(esc(intro))}${pay?.html ?? ""}${button(url, "Bekijk je bestelling")}${itemsHtml(o)}${addressesHtml(o)}${note.html}${helpHtml}${signHtml}`,
    );
    const text = `Hallo ${name},\n\n${intro}\n\n${pay ? `${pay.text}\n\n` : ""}${itemsText(o)}\n\n${addressesText(o)}\n\n${note.text}Je bestelling bekijken: ${url}\n\n${help}\n\n${sign}`;
    return { subject, text, html };
  }

  if (kind === "verzonden") {
    const subject = `Je bestelling ${o.number} is verzonden`;
    const track = o.trackingCode || o.trackingUrl;
    const trackHtml = track
      ? box(`<strong style="color:${NAVY}">Track &amp; trace</strong><br>${o.trackingCode ? `Code: <strong>${esc(o.trackingCode)}</strong><br>` : ""}${o.trackingUrl ? `<a href="${esc(o.trackingUrl)}" style="color:${BLUE}">Volg je pakket</a>` : ""}`)
      : "";
    const trackText = track ? `Track & trace${o.trackingCode ? `: ${o.trackingCode}` : ""}${o.trackingUrl ? `\nVolg je pakket: ${o.trackingUrl}` : ""}\n\n` : "";
    const html = await mailLayout(subject, `${h1("Je bestelling is onderweg")}${p(`Hallo ${esc(name)},`)}${p(`Goed nieuws: je bestelling ${esc(o.number)} is verzonden.`)}${trackHtml}${button(url, "Bekijk je bestelling")}${itemsHtml(o)}${addressesHtml(o)}${helpHtml}${signHtml}`);
    const text = `Hallo ${name},\n\nGoed nieuws: je bestelling ${o.number} is verzonden.\n\n${trackText}${itemsText(o)}\n\n${addressesText(o)}\n\nJe bestelling bekijken: ${url}\n\n${help}\n\n${sign}`;
    return { subject, text, html };
  }

  if (kind === "geannuleerd") {
    const subject = `Je bestelling ${o.number} is geannuleerd`;
    const reason = extra.reason?.trim();
    const paid = o.paidAt ? "Had je al betaald? Dan nemen we contact met je op over de terugbetaling." : "";
    const html = await mailLayout(
      subject,
      `${h1("Je bestelling is geannuleerd")}${p(`Hallo ${esc(name)},`)}${p(`Je bestelling ${esc(o.number)} is geannuleerd.${reason ? ` Reden: ${esc(reason)}` : ""}`)}${paid ? p(esc(paid)) : ""}${itemsHtml(o)}${helpHtml}${signHtml}`,
    );
    const text = `Hallo ${name},\n\nJe bestelling ${o.number} is geannuleerd.${reason ? ` Reden: ${reason}` : ""}\n${paid ? `${paid}\n` : ""}\n${itemsText(o)}\n\n${help}\n\n${sign}`;
    return { subject, text, html };
  }

  // melding voor de winkel
  const paidNow = o.paymentStatus === "paid";
  const subject = `Nieuwe bestelling ${o.number} (${money(o.total)})${paidNow ? "" : ", wacht op betaling"}`;
  const admin = `${SITE_URL}/admin/bestellingen/`;
  const who = `${[shipAddr(o)?.firstName, shipAddr(o)?.lastName].filter(Boolean).join(" ") || "Klant"}, ${o.email}${o.phone ? `, ${o.phone}` : ""}`;
  const payLine = `Betaling: ${PAYMENT_PROVIDER[o.paymentProvider] ?? o.paymentProvider}${o.paymentMethod ? ` (${o.paymentMethod})` : ""}, ${paidNow ? "betaald" : "nog niet betaald"}`;
  const html = await mailLayout(
    subject,
    `${h1(`Nieuwe bestelling ${o.number}`)}${p(`${esc(who)}<br>${esc(payLine)}`)}${button(admin, "Open in het beheer")}${itemsHtml(o)}${addressesHtml(o)}${o.note ? p(`<strong style="color:${NAVY}">Opmerking van de klant</strong><br>${esc(o.note).replace(/\n/g, "<br>")}`) : ""}`,
  );
  const text = `Nieuwe bestelling ${o.number}\n\n${who}\n${payLine}\n\n${itemsText(o)}\n\n${addressesText(o)}\n\n${o.note ? `Opmerking van de klant: ${o.note}\n\n` : ""}Beheer: ${admin}`;
  return { subject, text, html };
}

/** E-mail met de link om een nieuw wachtwoord in te stellen (1 uur geldig). */
export async function resetMail(firstName: string, link: string): Promise<BuiltMail> {
  const site = await getSite();
  const subject = `Nieuw wachtwoord instellen voor je account bij ${BRAND}`;
  const html = await mailLayout(
    subject,
    `${h1("Nieuw wachtwoord instellen")}${p(`Hallo ${esc(firstName)},`)}${p("Je hebt gevraagd om een nieuw wachtwoord voor je account. Klik op de knop om een nieuw wachtwoord te kiezen. De link is 1 uur geldig.")}${button(link, "Nieuw wachtwoord kiezen")}${p(`<span style="color:${MUTED};font-size:13px">Heb je dit niet aangevraagd? Dan hoef je niets te doen: je wachtwoord blijft ongewijzigd.</span>`)}${p(`Met vriendelijke groet,<br><strong style="color:${NAVY}">${esc(site.name)}</strong>`)}`,
  );
  const text = `Hallo ${firstName},\n\nJe hebt gevraagd om een nieuw wachtwoord voor je account. Open deze link om een nieuw wachtwoord te kiezen (1 uur geldig):\n${link}\n\nHeb je dit niet aangevraagd? Dan hoef je niets te doen: je wachtwoord blijft ongewijzigd.\n\nMet vriendelijke groet,\n${site.name}`;
  return { subject, text, html };
}
