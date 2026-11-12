import "server-only";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/components/shop/order-status";
import { db } from "./db";
import { sendMail } from "./mail";
import { money } from "./money";
import { MollieError, centsOf, createRefund, getPayment, mollieKey } from "./mollie";
import { orderMail, type OrderMailKind } from "./order-mails";
import { parse } from "./json";
import { getShop, getSite } from "./settings";

// Alles wat de status van een bestelling verandert loopt via dit bestand: de webhook van Mollie, de testbetaling,
// de bedankpagina en het beheer. Zo gebeurt het afboeken van voorraad en het versturen van e-mails op één plek en
// precies één keer (idempotent), ook als dezelfde webhook twee keer binnenkomt.

export { ORDER_STATUS, PAYMENT_STATUS };
/** `retry`: tijdelijke storing bij Mollie; de webhook antwoordt dan met een fout zodat Mollie het later opnieuw probeert. */
export type OrderResult = { ok: boolean; message: string; retry?: boolean };

const ok = (message: string): OrderResult => ({ ok: true, message });
const fail = (message: string): OrderResult => ({ ok: false, message });

type Tx = Prisma.TransactionClient;

/** Cache van productpagina's en de layout verversen. Tijdens het renderen van een pagina mag dat niet: dan overslaan. */
function refresh(paths: string[]) {
  try {
    for (const p of new Set(paths.filter(Boolean))) revalidatePath(p);
    revalidatePath("/", "layout");
  } catch {
    /* aangeroepen tijdens het renderen (bedankpagina): de cache wordt bij de volgende actie ververst */
  }
}

/**
 * E-mail voor een bestelling precies één keer versturen. De sleutel wordt eerst atomair in `mailsSent` gezet; alleen
 * wie die schrijfactie wint, verstuurt. Een mislukte verzending staat in het verzendlog (MailLog) en wordt niet herhaald.
 * Geeft terug of de e-mail nu echt is verstuurd (false: al eerder verstuurd, e-mail niet ingesteld of mislukt).
 */
export async function mailOnce(orderId: string, kind: OrderMailKind, extra: { reason?: string } = {}): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) return false;
    const sent = parse<string[]>(order.mailsSent, []);
    if (sent.includes(kind)) return false;
    const claim = await db.order.updateMany({ where: { id: orderId, mailsSent: order.mailsSent }, data: { mailsSent: JSON.stringify([...sent, kind]) } });
    if (!claim.count) continue;
    try {
      const to = kind === "winkel" ? (await getShop()).orderNotifyEmail.trim() || (await getSite()).email : order.email;
      const built = await orderMail(kind, order, extra);
      const mail = { to, subject: built.subject, text: built.text, html: built.html, ...(kind === "winkel" ? { replyTo: order.email } : {}) };
      return (await sendMail(mail)).sent;
    } catch (e) {
      console.error(`[orders] e-mail "${kind}" voor ${order.number} is niet verstuurd:`, e instanceof Error ? e.message : e);
    }
    return false;
  }
  return false;
}

/** Zin voor de melding in het beheer: is de e-mail naar de klant echt de deur uit? */
const mailNote = (sent: boolean, what: string) => (sent ? `De klant heeft ${what} gekregen.` : `Let op: ${what} is niet verstuurd (e-mail is niet ingesteld of mislukt; zie Connecties → E-mail).`);

/** Voorraad van de regels af- of terugboeken (sign -1 = afboeken, +1 = terugboeken). Nooit onder 0. */
async function bookStock(tx: Tx, items: { productId: string | null; variantId: string | null; quantity: number }[], sign: 1 | -1) {
  for (const i of items) {
    if (!i.productId) continue;
    const product = await tx.product.findUnique({ where: { id: i.productId }, select: { id: true, stock: true, sold: true, trackStock: true } });
    if (!product) continue;
    const sold = Math.max(0, product.sold - sign * i.quantity);
    if (!product.trackStock) {
      await tx.product.update({ where: { id: product.id }, data: { sold } });
      continue;
    }
    const variant = i.variantId ? await tx.variant.findUnique({ where: { id: i.variantId }, select: { id: true, stock: true, productId: true } }) : null;
    if (variant && variant.productId === product.id) {
      await tx.variant.update({ where: { id: variant.id }, data: { stock: Math.max(0, variant.stock + sign * i.quantity) } });
      // voorraad van het product = som van de varianten
      const sum = await tx.variant.aggregate({ where: { productId: product.id }, _sum: { stock: true } });
      await tx.product.update({ where: { id: product.id }, data: { stock: sum._sum.stock ?? 0, sold } });
    } else {
      await tx.product.update({ where: { id: product.id }, data: { stock: Math.max(0, product.stock + sign * i.quantity), sold } });
    }
  }
}

/**
 * De overgang naar "betaald". Alleen de eerste aanroep (paidAt nog leeg) boekt voorraad af, telt de kortingscode en
 * verstuurt de e-mails; elke volgende aanroep doet niets.
 */
async function settlePaid(orderId: string, info: { paymentId?: string; method?: string } = {}): Promise<OrderResult> {
  const first = await db.$transaction(async (tx) => {
    const claim = await tx.order.updateMany({
      where: { id: orderId, paidAt: null },
      data: { status: "paid", paymentStatus: "paid", paidAt: new Date(), stockBooked: true, cancelledAt: null, ...(info.paymentId ? { paymentId: info.paymentId } : {}), ...(info.method ? { paymentMethod: info.method } : {}) },
    });
    if (!claim.count) return null;
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) return null;
    await bookStock(tx, order.items, -1);
    if (order.discountCode) await tx.discount.updateMany({ where: { code: order.discountCode }, data: { used: { increment: 1 } } });
    return order;
  });
  if (!first) {
    const exists = await db.order.findUnique({ where: { id: orderId }, select: { number: true } });
    return exists ? ok(`Bestelling ${exists.number} was al als betaald verwerkt.`) : fail("Deze bestelling bestaat niet.");
  }
  const mailed = await mailOnce(orderId, "bevestiging");
  await mailOnce(orderId, "winkel");
  refresh(first.items.map((i) => i.path));
  return ok(`Bestelling ${first.number} is betaald en de voorraad is bijgewerkt. ${mailNote(mailed, "de orderbevestiging")}`);
}

/** Bestelling als betaald markeren (beheer: overboeking ontvangen; of na een geslaagde online betaling). */
export async function markOrderPaid(orderId: string, info?: { paymentId?: string; method?: string }): Promise<OrderResult> {
  const order = await db.order.findUnique({ where: { id: orderId }, select: { number: true, paidAt: true, status: true } });
  if (!order) return fail("Deze bestelling bestaat niet.");
  if (order.paidAt) return fail(`Bestelling ${order.number} is al eerder betaald.`);
  return settlePaid(orderId, info);
}

/**
 * Status van een betaling verwerken (Mollie-status: open, pending, authorized, paid, failed, expired, canceled).
 * Gebruikt door de webhook, de bedankpagina en de testbetaling. Een betaalde bestelling gaat nooit meer terug naar
 * open of mislukt.
 */
export async function applyPaymentStatus(orderId: string, mollieStatus: string, info: { paymentId?: string; method?: string } = {}): Promise<OrderResult> {
  if (mollieStatus === "paid") return settlePaid(orderId, info);
  const paymentStatus = mollieStatus === "failed" || mollieStatus === "expired" || mollieStatus === "canceled" ? mollieStatus : "open";
  const res = await db.order.updateMany({ where: { id: orderId, paidAt: null, paymentStatus: { notIn: ["paid", "refunded", "partially_refunded"] } }, data: { paymentStatus, ...(info.method ? { paymentMethod: info.method } : {}) } });
  return res.count ? ok(`Betaalstatus bijgewerkt: ${PAYMENT_STATUS[paymentStatus]?.label ?? paymentStatus}.`) : ok("Geen wijziging.");
}

/**
 * Betaling opnieuw ophalen bij Mollie en de bijbehorende bestelling bijwerken. De bestelling wordt gezocht via
 * `metadata.orderId` en anders via het bewaarde betaling-id.
 */
export async function syncMolliePayment(paymentId: string): Promise<OrderResult> {
  if (!/^tr_[A-Za-z0-9]+$/.test(paymentId)) return fail("Ongeldig betaling-id.");
  if (!(await mollieKey())) return fail("Mollie is niet ingesteld.");
  let payment;
  try {
    payment = await getPayment(paymentId);
  } catch (e) {
    return { ...fail(e instanceof Error ? e.message : "De betaling kon niet worden opgehaald."), retry: e instanceof MollieError && e.temporary };
  }
  const metaId = typeof payment.metadata?.orderId === "string" ? payment.metadata.orderId : "";
  const order = (metaId ? await db.order.findUnique({ where: { id: metaId } }) : null) ?? (await db.order.findFirst({ where: { paymentId: payment.id } }));
  if (!order) return fail("Geen bestelling gevonden bij deze betaling.");
  // Het bedrag moet kloppen met de bestelling (bescherming tegen een betaling die bij een andere order hoort)
  if (payment.amount.currency !== "EUR" || centsOf(payment.amount) !== order.total) return fail("Het bedrag van de betaling komt niet overeen met de bestelling.");

  if (payment.status === "paid") {
    const res = await settlePaid(order.id, { paymentId: payment.id, method: payment.method ?? undefined });
    // terugbetalingen die buiten de site om (in het Mollie-dashboard) zijn gedaan overnemen
    const refunded = centsOf(payment.amountRefunded);
    if (refunded > 0) {
      const full = refunded >= order.total;
      await db.order.updateMany({ where: { id: order.id, refundedAmount: { lt: refunded } }, data: { refundedAmount: refunded, paymentStatus: full ? "refunded" : "partially_refunded", ...(full ? { status: "refunded" } : {}) } });
    }
    return res;
  }
  // Een oudere, vervangen betaling (na "opnieuw proberen") mag de status van de nieuwe poging niet overschrijven
  if (order.paymentId && order.paymentId !== payment.id) return ok("Deze betaling is vervangen door een nieuwe poging.");
  return applyPaymentStatus(order.id, payment.status, { method: payment.method ?? undefined });
}

/** Bestelling annuleren: status, voorraad terugboeken als die was afgeboekt, annuleringsmail naar de klant. */
export async function cancelOrder(orderId: string, reason?: string): Promise<OrderResult> {
  const result = await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) return { error: "Deze bestelling bestaat niet." };
    if (order.status === "cancelled") return { error: `Bestelling ${order.number} is al geannuleerd.` };
    if (order.status === "shipped" || order.status === "completed") return { error: `Bestelling ${order.number} is al verzonden en kan niet meer worden geannuleerd. Gebruik terugbetalen.` };
    if (order.status === "refunded") return { error: `Bestelling ${order.number} is al terugbetaald.` };
    const claim = await tx.order.updateMany({
      where: { id: orderId, status: order.status, stockBooked: order.stockBooked },
      data: { status: "cancelled", cancelledAt: new Date(), stockBooked: false, ...(order.paidAt ? {} : { paymentStatus: order.paymentStatus === "open" ? "canceled" : order.paymentStatus }) },
    });
    if (!claim.count) return { error: "De bestelling is zojuist door iemand anders gewijzigd. Probeer het opnieuw." };
    if (order.stockBooked) {
      await bookStock(tx, order.items, 1);
      if (order.discountCode) await tx.discount.updateMany({ where: { code: order.discountCode, used: { gt: 0 } }, data: { used: { decrement: 1 } } });
    }
    return { order };
  });
  if ("error" in result) return fail(result.error!);
  const { order } = result;
  const mailed = await mailOnce(orderId, "geannuleerd", { reason });
  refresh(order.items.map((i) => i.path));
  const paidNote = order.paidAt && order.refundedAmount < order.total ? " Let op: de betaling is niet automatisch terugbetaald." : "";
  return ok(`Bestelling ${order.number} is geannuleerd${order.stockBooked ? " en de voorraad is teruggeboekt" : ""}. ${mailNote(mailed, "de annuleringsmail")}${paidNote}`);
}

/** Bestelling verzenden: status "shipped", track & trace bewaren, verzendmail naar de klant (één keer). */
export async function shipOrder(orderId: string, tracking: { trackingCode?: string; trackingUrl?: string } = {}): Promise<OrderResult> {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) return fail("Deze bestelling bestaat niet.");
  const trackingCode = tracking.trackingCode?.trim().slice(0, 80) || null;
  const trackingUrl = tracking.trackingUrl?.trim().slice(0, 500) || null;
  if (trackingUrl && !/^https?:\/\/[^\s"'<>]+$/i.test(trackingUrl)) return fail("De track & trace-link moet beginnen met https://.");
  if (order.status === "shipped" || order.status === "completed") {
    // al verzonden: alleen de track & trace bijwerken, geen tweede e-mail
    await db.order.update({ where: { id: orderId }, data: { trackingCode: trackingCode ?? order.trackingCode, trackingUrl: trackingUrl ?? order.trackingUrl } });
    return ok(`Bestelling ${order.number} was al verzonden. De track & trace is bijgewerkt.`);
  }
  if (order.status !== "paid") return fail(order.status === "pending" ? `Bestelling ${order.number} is nog niet betaald. Markeer hem eerst als betaald.` : `Bestelling ${order.number} kan niet worden verzonden (status: ${ORDER_STATUS[order.status]?.label ?? order.status}).`);
  const claim = await db.order.updateMany({ where: { id: orderId, status: "paid" }, data: { status: "shipped", shippedAt: new Date(), trackingCode, trackingUrl } });
  if (!claim.count) return fail("De bestelling is zojuist door iemand anders gewijzigd. Probeer het opnieuw.");
  const mailed = await mailOnce(orderId, "verzonden");
  return ok(`Bestelling ${order.number} is verzonden. ${mailNote(mailed, "de verzendmail")}`);
}

/** Bestelling afronden (na verzending of afhalen). */
export async function completeOrder(orderId: string): Promise<OrderResult> {
  const order = await db.order.findUnique({ where: { id: orderId }, select: { number: true, status: true } });
  if (!order) return fail("Deze bestelling bestaat niet.");
  if (order.status === "completed") return fail(`Bestelling ${order.number} is al afgerond.`);
  if (order.status !== "paid" && order.status !== "shipped") return fail(`Bestelling ${order.number} kan niet worden afgerond (status: ${ORDER_STATUS[order.status]?.label ?? order.status}).`);
  const claim = await db.order.updateMany({ where: { id: orderId, status: order.status }, data: { status: "completed" } });
  return claim.count ? ok(`Bestelling ${order.number} is afgerond.`) : fail("De bestelling is zojuist door iemand anders gewijzigd. Probeer het opnieuw.");
}

/**
 * (Deels) terugbetalen. Bij een Mollie-betaling gaat het bedrag via Mollie terug naar de klant; bij een overboeking of
 * testbetaling wordt het alleen administratief vastgelegd (zelf overmaken). De voorraad verandert hierdoor niet.
 */
export async function refundOrder(orderId: string, amountCents: number): Promise<OrderResult> {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) return fail("Deze bestelling bestaat niet.");
  if (!order.paidAt || (order.paymentStatus !== "paid" && order.paymentStatus !== "partially_refunded")) return fail(`Bestelling ${order.number} is niet betaald of al volledig terugbetaald.`);
  const amount = Math.round(amountCents);
  const open = order.total - order.refundedAmount;
  if (!Number.isFinite(amount) || amount <= 0) return fail("Vul een bedrag in dat hoger is dan € 0,00.");
  if (amount > open) return fail(`Je kunt maximaal ${money(open)} terugbetalen.`);

  // Eerst het bedrag reserveren (voorkomt dubbel terugbetalen bij twee gelijktijdige klikken), dan pas Mollie aanroepen
  const refundedAmount = order.refundedAmount + amount;
  const full = refundedAmount >= order.total;
  const claim = await db.order.updateMany({
    where: { id: orderId, refundedAmount: order.refundedAmount },
    data: { refundedAmount, paymentStatus: full ? "refunded" : "partially_refunded", ...(full ? { status: "refunded" } : {}) },
  });
  if (!claim.count) return fail("De bestelling is zojuist door iemand anders gewijzigd. Probeer het opnieuw.");

  const viaMollie = order.paymentProvider === "mollie" && !!order.paymentId;
  if (viaMollie) {
    try {
      if (!(await mollieKey())) throw new Error("Mollie is niet ingesteld.");
      await createRefund(order.paymentId!, amount, `Terugbetaling ${order.number}`);
    } catch (e) {
      // terugdraaien: er is niets terugbetaald
      await db.order.updateMany({ where: { id: orderId, refundedAmount }, data: { refundedAmount: order.refundedAmount, paymentStatus: order.paymentStatus, status: order.status } });
      return fail(`Terugbetalen via Mollie is mislukt: ${e instanceof Error ? e.message : "onbekende fout"}`);
    }
  }
  return ok(`${money(amount)} van bestelling ${order.number} is ${viaMollie ? "via Mollie terugbetaald" : "administratief als terugbetaald vastgelegd (maak het bedrag zelf over)"}.`);
}

/** Nieuw, uniek oplopend bestelnummer binnen een transactie: voorvoegsel + volgnummer vanaf 10001. */
export async function nextOrderNumber(tx: Tx, prefix: string) {
  const rows = await tx.order.findMany({ where: { number: { startsWith: prefix } }, select: { number: true }, orderBy: { createdAt: "desc" }, take: 25 });
  let max = 10000;
  for (const r of rows) {
    const n = Number(r.number.slice(prefix.length));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return `${prefix}${max + 1}`;
}
