"use server";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { OrderAddress } from "@/components/shop/order-status";
import { clearCart, computeCart, readCartState, writeCartState } from "@/lib/cart";
import { BCRYPT_COST, currentCustomer, emailSchema, parseAddress, passwordSchema, phoneSchema, startCustomerSession } from "@/lib/customer";
import { db } from "@/lib/db";
import { money } from "@/lib/money";
import { createPayment, listMethods, paymentMode, simulationEnabled } from "@/lib/mollie";
import { applyPaymentStatus, mailOnce, nextOrderNumber, syncMolliePayment } from "@/lib/orders";
import { rateLimit } from "@/lib/rate-limit";
import { getShop } from "@/lib/settings";

// Afrekenen: bestelling plaatsen, (test)betaling verwerken en een mislukte betaling opnieuw proberen. Alles wordt op
// de server nagerekend: het bedrag komt uit de winkelwagen zoals de database hem nu ziet, nooit uit de browser.

export type CheckoutState = { errors: Record<string, string>; values: Record<string, string>; message?: string };

const SECRET_FIELDS = new Set(["password"]);

function valuesOf(form: FormData) {
  const values: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string" && !SECRET_FIELDS.has(k) && !k.startsWith("$")) values[k] = v.slice(0, 1000);
  return values;
}

const isUnique = (e: unknown, field: string) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && JSON.stringify(e.meta?.target ?? "").includes(field);

export async function placeOrder(_: CheckoutState, form: FormData): Promise<CheckoutState> {
  const values = valuesOf(form);
  const back = (errors: Record<string, string>, message?: string): CheckoutState => ({ errors, values, message: message ?? "Nog niet alles is goed ingevuld. Controleer de gemarkeerde velden." });
  if (!(await rateLimit("bestellen", 10, 10 * 60 * 1000))) return back({}, "Te veel pogingen achter elkaar. Probeer het over een paar minuten opnieuw.");

  const shop = await getShop();
  const countries = shop.shipping.map((c) => c.country);
  const customer = await currentCustomer();
  const errors: Record<string, string> = {};
  const str = (k: string) => String(form.get(k) ?? "");

  // ---- invoer controleren ----
  const email = customer ? { success: true as const, data: customer.email } : emailSchema.safeParse(str("email"));
  if (!email.success) errors.email = email.error.issues[0].message;
  const phone = phoneSchema.safeParse(str("phone"));
  if (!phone.success) errors.phone = phone.error.issues[0].message;
  const shipping = parseAddress(form, countries);
  if (!shipping.ok) Object.assign(errors, shipping.errors);
  const billingDifferent = str("billingDifferent") === "on";
  const billing = billingDifferent ? parseAddress(form, countries, "b_") : shipping;
  if (!billing.ok) Object.assign(errors, billing.errors);
  const note = z.string().trim().max(1000, "Je opmerking is te lang (maximaal 1000 tekens)").safeParse(str("note"));
  if (!note.success) errors.note = note.error.issues[0].message;
  if (str("terms") !== "on") errors.terms = "Ga akkoord met de algemene voorwaarden om te bestellen";
  const createAccount = !customer && str("createAccount") === "on";
  let passwordHash = "";
  if (createAccount) {
    const pw = passwordSchema.safeParse(str("password"));
    if (!pw.success) errors.password = pw.error.issues[0].message;
    else if (email.success) {
      if (await db.customer.findUnique({ where: { email: email.data }, select: { id: true } })) errors.email = "Er bestaat al een account met dit e-mailadres. Log in, of bestel zonder account aan te maken.";
      else passwordHash = await bcrypt.hash(pw.data, BCRYPT_COST);
    }
  }
  const method = str("method");
  if (!/^[a-z0-9_]{0,30}$/.test(method)) errors.method = "Kies een betaalmethode";
  if (Object.keys(errors).length || !email.success || !phone.success || !shipping.ok || !billing.ok || !note.success) return back(errors);

  // ---- winkelwagen opnieuw doorrekenen ----
  const state = await readCartState();
  const { cart, state: clean } = await computeCart({ ...state, country: shipping.data.country });
  if (!cart.lines.length) redirect("/winkelwagen/?melding=leeg");
  if (!cart.orderable) {
    // voorraad is veranderd: opgeschoonde wagen bewaren en terug naar de winkelwagen
    await writeCartState(clean, cart.count);
    revalidatePath("/winkelwagen/");
    redirect("/winkelwagen/?melding=voorraad");
  }
  // Het bedrag dat de klant zag moet het bedrag zijn dat we in rekening brengen (land, prijs of korting gewijzigd?)
  if (Number(str("total")) !== cart.total) {
    await writeCartState(clean, cart.count);
    revalidatePath("/afrekenen/");
    return back({}, `Het totaalbedrag is gewijzigd naar ${money(cart.total)} (bijvoorbeeld door het gekozen land of een prijswijziging). Controleer het overzicht en plaats je bestelling opnieuw.`);
  }

  const mode = await paymentMode();
  if (mode === "mollie" && method) {
    const methods = await listMethods(cart.total);
    if (methods.length && !methods.some((m) => m.id === method)) return back({ method: "Deze betaalmethode is niet beschikbaar voor deze bestelling. Kies een andere." });
  }

  // ---- bestelling aanmaken (één transactie) ----
  const ship: OrderAddress = shipping.data;
  const bill: OrderAddress = billing.data;
  const lines = cart.lines.filter((l) => l.inStock);
  let created: { id: string; number: string; token: string; total: number } | null = null;
  let newCustomer: { id: string; firstName: string; passwordHash: string } | null = null;
  for (let attempt = 0; attempt < 6 && !created; attempt++) {
    const token = randomBytes(24).toString("base64url");
    try {
      const res = await db.$transaction(async (tx) => {
        let customerId = customer?.id ?? null;
        let fresh: typeof newCustomer = null;
        if (createAccount) {
          fresh = await tx.customer.create({
            data: { email: email.data, passwordHash, firstName: ship.firstName, lastName: ship.lastName, phone: phone.data, newsletter: str("newsletter") === "on", lastLoginAt: new Date() },
            select: { id: true, firstName: true, passwordHash: true },
          });
          customerId = fresh.id;
          // eerdere gastbestellingen met hetzelfde e-mailadres horen nu bij dit account
          await tx.order.updateMany({ where: { email: email.data, customerId: null }, data: { customerId } });
        }
        const number = await nextOrderNumber(tx, shop.orderPrefix);
        const order = await tx.order.create({
          data: {
            number,
            token,
            customerId,
            email: email.data,
            phone: phone.data,
            status: "pending",
            paymentStatus: "open",
            paymentProvider: mode,
            paymentMethod: mode === "mollie" ? method : "",
            shippingAddress: JSON.stringify(ship),
            billingAddress: JSON.stringify(bill),
            subtotal: cart.subtotal,
            shippingCost: cart.shipping,
            discountCode: cart.discount?.code ?? null,
            discountAmount: cart.discount?.amount ?? 0,
            total: cart.total,
            vatAmount: cart.vat,
            note: note.data,
            items: {
              create: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, name: l.name, variantName: l.variantName, sku: l.sku, image: l.image, path: l.path, unitPrice: l.unitPrice, quantity: l.quantity, vatRate: l.vatRate, total: l.lineTotal })),
            },
          },
          select: { id: true, number: true, token: true, total: true },
        });
        if (customerId) {
          // adres bewaren in het adresboek als het daar nog niet in staat
          const known = await tx.address.findMany({ where: { customerId } });
          const same = (a: (typeof known)[number], b: OrderAddress, type: string) => a.type === type && a.country === b.country && a.postalCode === b.postalCode && a.houseNumber === b.houseNumber && a.addition === b.addition;
          if (!known.some((a) => same(a, ship, "shipping"))) await tx.address.create({ data: { customerId, type: "shipping", ...ship, isDefault: !known.some((a) => a.type === "shipping" && a.isDefault) } });
          if (billingDifferent && !known.some((a) => same(a, bill, "billing"))) await tx.address.create({ data: { customerId, type: "billing", ...bill, isDefault: !known.some((a) => a.type === "billing" && a.isDefault) } });
          if (customer && ((!customer.phone && phone.data) || (str("newsletter") === "on" && !customer.newsletter)))
            await tx.customer.update({ where: { id: customer.id }, data: { ...(!customer.phone && phone.data ? { phone: phone.data } : {}), ...(str("newsletter") === "on" ? { newsletter: true } : {}) } });
        }
        return { order, fresh };
      });
      created = res.order;
      newCustomer = res.fresh;
    } catch (e) {
      if (isUnique(e, "email")) return back({ email: "Er bestaat al een account met dit e-mailadres. Log in, of bestel zonder account aan te maken." });
      // bestelnummer of token net door een gelijktijdige bestelling gebruikt: opnieuw proberen met het volgende nummer
      if (isUnique(e, "number") || isUnique(e, "token") || (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2034" || e.code === "P2028"))) continue;
      console.error("[afrekenen] bestelling aanmaken mislukt:", e);
      // een vergrendelde database (gelijktijdige bestelling) lost zichzelf op: nog twee keer proberen
      if (attempt < 2) continue;
      return back({}, "Je bestelling kon niet worden geplaatst door een technische storing. Er is niets afgeschreven. Probeer het opnieuw.");
    }
  }
  if (!created) return back({}, "Het is op dit moment erg druk. Je bestelling is niet geplaatst en er is niets afgeschreven. Probeer het opnieuw.");
  const order = created;

  if (str("newsletter") === "on") await db.subscriber.upsert({ where: { email: email.data }, create: { email: email.data, source: "checkout" }, update: {} }).catch(() => {});
  if (newCustomer) await startCustomerSession(newCustomer);

  // ---- betalen ----
  let target = `/bestelling/?t=${order.token}`;
  if (order.total <= 0) {
    // niets te betalen (volledige korting): direct als betaald verwerken
    await applyPaymentStatus(order.id, "paid", { method: "korting" });
    await clearCart();
  } else if (mode === "overboeking") {
    await clearCart();
    await mailOnce(order.id, "betaalinstructie");
    await mailOnce(order.id, "winkel");
  } else {
    // wagen bewaren tot de betaling binnen is; `o` koppelt hem aan deze bestelling
    await writeCartState({ ...clean, o: order.id }, cart.count);
    if (mode === "simulatie") target = `/afrekenen/testbetaling/?t=${order.token}`;
    else {
      try {
        const payment = await createPayment(order, method || undefined);
        await db.order.update({ where: { id: order.id }, data: { paymentId: payment.id } });
        target = payment.checkoutUrl;
      } catch (e) {
        console.error("[afrekenen] Mollie-betaling aanmaken mislukt:", e instanceof Error ? e.message : e);
        target = `/bestelling/?t=${order.token}&fout=betaling`;
      }
    }
  }
  revalidatePath("/winkelwagen/");
  redirect(target);
}

const findByToken = (token: string) => (/^[A-Za-z0-9_-]{32,64}$/.test(token) ? db.order.findUnique({ where: { token }, include: { items: true } }) : null);

/** Testbetaling (alleen als simulatie aan staat): zelfde verwerking als de webhook van Mollie. */
export async function simulatePayment(form: FormData) {
  const token = String(form.get("t") ?? "");
  const outcome = String(form.get("outcome") ?? "");
  const order = await findByToken(token);
  if (!order || !(await simulationEnabled()) || order.paymentProvider !== "simulatie" || !["paid", "failed", "canceled"].includes(outcome)) redirect("/");
  if (!order.paidAt && order.status === "pending") {
    await applyPaymentStatus(order.id, outcome, { method: "test" });
    if (outcome === "paid" && (await readCartState()).o === order.id) await clearCart();
  }
  redirect(`/bestelling/?t=${order.token}`);
}

/** Mislukte, verlopen of geannuleerde betaling: nieuwe betaling starten voor dezelfde bestelling. */
export async function retryPayment(form: FormData) {
  const order = await findByToken(String(form.get("t") ?? ""));
  if (!order) redirect("/");
  const page = `/bestelling/?t=${order.token}`;
  if (!(await rateLimit("opnieuw-betalen", 10, 10 * 60 * 1000))) redirect(`${page}&fout=druk`);
  // eerst de laatste stand bij Mollie ophalen: misschien is er toch al betaald
  if (order.paymentProvider === "mollie" && order.paymentId && !order.paidAt) await syncMolliePayment(order.paymentId);
  const now = await db.order.findUnique({ where: { id: order.id }, select: { paidAt: true, status: true } });
  if (!now || now.paidAt || now.status !== "pending") redirect(page);

  // is alles nog op voorraad?
  for (const i of order.items) {
    if (!i.productId) continue;
    const p = await db.product.findUnique({ where: { id: i.productId }, select: { stock: true, trackStock: true, status: true, deletedAt: true, variants: { select: { id: true, stock: true } } } });
    const stock = i.variantId ? (p?.variants.find((v) => v.id === i.variantId)?.stock ?? 0) : (p?.stock ?? 0);
    if (!p || p.deletedAt || p.status !== "published" || (p.trackStock && stock < i.quantity)) redirect(`${page}&fout=voorraad`);
  }

  const mode = await paymentMode();
  let target = page;
  if (mode === "mollie") {
    try {
      const payment = await createPayment(order);
      await db.order.updateMany({ where: { id: order.id, paidAt: null }, data: { paymentProvider: "mollie", paymentId: payment.id, paymentStatus: "open", paymentMethod: "" } });
      target = payment.checkoutUrl;
    } catch (e) {
      console.error("[afrekenen] Mollie-betaling aanmaken mislukt:", e instanceof Error ? e.message : e);
      target = `${page}&fout=betaling`;
    }
  } else {
    await db.order.updateMany({ where: { id: order.id, paidAt: null }, data: { paymentProvider: mode, paymentStatus: "open", paymentMethod: "", paymentId: null } });
    if (mode === "simulatie") target = `/afrekenen/testbetaling/?t=${order.token}`;
    else {
      await mailOnce(order.id, "betaalinstructie");
      await mailOnce(order.id, "winkel");
    }
  }
  redirect(target);
}

/**
 * Aangeroepen door de bedankpagina: leegt de winkelwagen als die bij deze (betaalde of per overboeking geplaatste)
 * bestelling hoort en ververst de productpagina's (voorraad). Geeft de stand voor de header terug.
 */
export async function finishOrder(token: string): Promise<{ count: number; total: number }> {
  const order = await findByToken(String(token ?? ""));
  const state = await readCartState();
  if (order && (order.paidAt || order.paymentProvider === "overboeking") && state.o === order.id) {
    await clearCart();
    for (const path of new Set(order.items.map((i) => i.path).filter(Boolean))) revalidatePath(path);
    revalidatePath("/", "layout");
    return { count: 0, total: 0 };
  }
  const { cart } = await computeCart(state);
  return { count: cart.count, total: cart.total };
}
