import "server-only";
import { cookies } from "next/headers";
import { db } from "./db";
import { money, vatOf } from "./money";
import { getShop } from "./settings";
import { imagesOf, live } from "./shop";

// Winkelwagen. In de cookie staan alleen product-id's, variant-id's en aantallen: prijzen, voorraad, namen en
// afbeeldingen komen bij elke berekening vers uit de database (nooit iets uit de browser vertrouwen).
// Alle bedragen zijn centen inclusief btw.

export const CART_COOKIE = "bpm_cart";
/** Leesbare cookie met alleen het aantal artikelen, zodat de header het bolletje kan tonen zonder serverronde. */
export const CART_COUNT_COOKIE = "bpm_cart_n";
const MAX_AGE = 30 * 86400;
const MAX_LINES = 50;
/** Bovengrens per regel (ook voor producten zonder voorraadbeheer). */
export const MAX_PER_LINE = 99;

/** Wat er in de cookie staat. `o` = id van de bestelling die uit deze wagen is geplaatst (wagen leeg na betaling). */
export type CartState = { items: { p: string; v: string | null; q: number }[]; code?: string; country?: string; o?: string };

export type CartLine = {
  /** sleutel van de regel: "<productId>" of "<productId>-<variantId>" */
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  variantName: string;
  path: string;
  image: string;
  imageAlt: string;
  sku: string;
  unitPrice: number;
  compareAtPrice: number | null;
  quantity: number;
  lineTotal: number;
  /** hoogste aantal dat besteld kan worden (voorraad, of MAX_PER_LINE zonder voorraadbeheer) */
  maxQuantity: number;
  inStock: boolean;
  vatRate: number;
};

export type Cart = {
  lines: CartLine[];
  /** totaal aantal artikelen (som van de aantallen) */
  count: number;
  subtotal: number;
  discount: { code: string; amount: number; label: string } | null;
  shipping: number;
  shippingCountry: string;
  /** bedrag dat nog ontbreekt voor gratis verzending (0 = al gratis, of gratis verzending bestaat niet) */
  freeShippingLeft: number;
  total: number;
  /** btw-bedrag dat in het totaal zit */
  vat: number;
  // ---- extra's bovenop het contract ----
  /** kortingssoort van de toegepaste code */
  discountType: "percent" | "fixed" | "shipping" | null;
  /** reden waarom de ingevulde code (nog) niet meetelt, bv. minimaal orderbedrag niet gehaald */
  discountNote: string | null;
  /** meldingen over aanpassingen: aantal verlaagd wegens voorraad, product niet meer leverbaar */
  notices: string[];
  /** true als alle regels leverbaar zijn in het gevraagde aantal en de wagen niet leeg is */
  orderable: boolean;
  /** drempel voor gratis verzending (0 = geen) */
  freeShippingFrom: number;
  /** landen waar naartoe verzonden wordt */
  countries: { country: string; label: string; cost: number }[];
};

export const lineKey = (p: string, v: string | null) => (v ? `${p}-${v}` : p);

const ID = /^[a-z0-9]{10,40}$/i;

/** Cookie lezen en opschonen (alleen geldige id's en aantallen). */
export async function readCartState(): Promise<CartState> {
  const raw = (await cookies()).get(CART_COOKIE)?.value;
  if (!raw) return { items: [] };
  try {
    const data = JSON.parse(raw) as Partial<CartState>;
    const items: CartState["items"] = [];
    for (const i of Array.isArray(data.items) ? data.items.slice(0, MAX_LINES) : []) {
      if (!i || typeof i.p !== "string" || !ID.test(i.p)) continue;
      const v = typeof i.v === "string" && ID.test(i.v) ? i.v : null;
      const q = Math.floor(Number(i.q));
      if (!Number.isFinite(q) || q < 1) continue;
      const same = items.find((x) => x.p === i.p && x.v === v);
      if (same) same.q = Math.min(MAX_PER_LINE, same.q + q);
      else items.push({ p: i.p, v, q: Math.min(MAX_PER_LINE, q) });
    }
    return {
      items,
      ...(typeof data.code === "string" && data.code ? { code: data.code.slice(0, 40) } : {}),
      ...(typeof data.country === "string" && /^[A-Z]{2}$/.test(data.country) ? { country: data.country } : {}),
      ...(typeof data.o === "string" && ID.test(data.o) ? { o: data.o } : {}),
    };
  } catch {
    return { items: [] };
  }
}

/** Cookie schrijven (alleen in server actions en route handlers). Een lege wagen zonder code verwijdert de cookie. */
export async function writeCartState(state: CartState, count: number) {
  const store = await cookies();
  const base = { secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: MAX_AGE };
  if (!state.items.length && !state.code && !state.country) {
    store.delete(CART_COOKIE);
    store.delete(CART_COUNT_COOKIE);
    return;
  }
  store.set(CART_COOKIE, JSON.stringify(state), { ...base, httpOnly: true });
  store.set(CART_COUNT_COOKIE, String(count), { ...base, httpOnly: false });
}

export async function clearCart() {
  const store = await cookies();
  store.delete(CART_COOKIE);
  store.delete(CART_COUNT_COOKIE);
}

export type DiscountCheck = { ok: true; code: string; type: "percent" | "fixed" | "shipping"; value: number; minOrder: number } | { ok: false; message: string; /** code bestaat wel, maar telt nu niet mee */ keep?: boolean };

/** Kortingscode controleren: bestaat, actief, binnen de looptijd, nog niet op, minimaal orderbedrag gehaald. */
export async function checkDiscount(code: string, subtotal: number): Promise<DiscountCheck> {
  const clean = code.trim().toUpperCase();
  if (!clean || clean.length > 40) return { ok: false, message: "Deze kortingscode is niet geldig." };
  // Codes worden in hoofdletters bewaard; voor de zekerheid ook de letterlijke invoer proberen
  const d = (await db.discount.findUnique({ where: { code: clean } })) ?? (await db.discount.findUnique({ where: { code: code.trim() } }));
  const now = new Date();
  if (!d || !d.active) return { ok: false, message: "Deze kortingscode is niet geldig." };
  if (d.startsAt && d.startsAt > now) return { ok: false, message: "Deze kortingscode is nog niet geldig." };
  if (d.endsAt && d.endsAt < now) return { ok: false, message: "Deze kortingscode is verlopen." };
  if (d.usageLimit != null && d.used >= d.usageLimit) return { ok: false, message: "Deze kortingscode is niet meer geldig." };
  if (d.type !== "percent" && d.type !== "fixed" && d.type !== "shipping") return { ok: false, message: "Deze kortingscode is niet geldig." };
  if (subtotal < d.minOrder) return { ok: false, keep: true, message: `Deze code geldt vanaf een bestelling van ${money(d.minOrder)}.` };
  return { ok: true, code: d.code, type: d.type, value: d.value, minOrder: d.minOrder };
}

/**
 * Winkelwagen doorrekenen vanuit de cookie-inhoud. Geeft ook de opgeschoonde cookie-inhoud terug (`state`): regels
 * van verdwenen producten zijn weg, aantallen zijn begrensd op de voorraad.
 */
export async function computeCart(input: CartState): Promise<{ cart: Cart; state: CartState }> {
  const shop = await getShop();
  const countries = shop.shipping;
  const shippingCountry = countries.find((c) => c.country === input.country)?.country ?? countries[0]?.country ?? "NL";

  const ids = [...new Set(input.items.map((i) => i.p))];
  const products = ids.length
    ? await db.product.findMany({
        where: { id: { in: ids }, ...live },
        select: { id: true, name: true, path: true, images: true, price: true, compareAtPrice: true, vatRate: true, sku: true, stock: true, trackStock: true, variants: { select: { id: true, name: true, price: true, compareAtPrice: true, sku: true, stock: true, image: true } } },
      })
    : [];

  const lines: CartLine[] = [];
  const items: CartState["items"] = [];
  const notices: string[] = [];
  for (const i of input.items) {
    const p = products.find((x) => x.id === i.p);
    if (!p) {
      notices.push("Een product in je winkelwagen is niet meer verkrijgbaar en is verwijderd.");
      continue;
    }
    const variant = i.v ? p.variants.find((x) => x.id === i.v) : null;
    // Een product met varianten kan alleen per variant besteld worden; een verdwenen variant vervalt
    if ((i.v && !variant) || (!i.v && p.variants.length)) {
      notices.push(`"${p.name}" is in deze uitvoering niet meer verkrijgbaar en is verwijderd.`);
      continue;
    }
    const stock = variant ? variant.stock : p.stock;
    const maxQuantity = p.trackStock ? Math.max(0, Math.min(MAX_PER_LINE, stock)) : MAX_PER_LINE;
    const inStock = maxQuantity > 0;
    const quantity = inStock ? Math.min(i.q, maxQuantity) : i.q;
    if (!inStock) notices.push(`"${p.name}" is helaas uitverkocht. Verwijder het artikel om verder te gaan.`);
    else if (quantity < i.q) notices.push(`Van "${p.name}" ${maxQuantity === 1 ? "is nog 1 stuk" : `zijn nog ${maxQuantity} stuks`} op voorraad. Het aantal is aangepast.`);
    const img = imagesOf(p)[0];
    const unitPrice = variant ? variant.price : p.price;
    lines.push({
      key: lineKey(p.id, variant?.id ?? null),
      productId: p.id,
      variantId: variant?.id ?? null,
      name: p.name,
      variantName: variant?.name ?? "",
      path: p.path,
      image: variant?.image || img?.src || "",
      imageAlt: img?.alt || p.name,
      sku: (variant?.sku || p.sku) ?? "",
      unitPrice,
      compareAtPrice: (variant ? variant.compareAtPrice : p.compareAtPrice) ?? null,
      quantity,
      lineTotal: inStock ? unitPrice * quantity : 0,
      maxQuantity,
      inStock,
      vatRate: p.vatRate,
    });
    items.push({ p: p.id, v: variant?.id ?? null, q: quantity });
  }

  const live_ = lines.filter((l) => l.inStock);
  const subtotal = live_.reduce((s, l) => s + l.lineTotal, 0);
  const count = live_.reduce((s, l) => s + l.quantity, 0);

  // korting
  let discount: Cart["discount"] = null;
  let discountType: Cart["discountType"] = null;
  let discountNote: string | null = null;
  let code = input.code;
  if (code && lines.length) {
    const d = await checkDiscount(code, subtotal);
    if (d.ok) {
      discountType = d.type;
      code = d.code;
      if (d.type === "percent") {
        const pct = Math.max(0, Math.min(100, d.value));
        discount = { code: d.code, amount: Math.round((subtotal * pct) / 100), label: `${pct}% korting` };
      } else if (d.type === "fixed") discount = { code: d.code, amount: Math.max(0, Math.min(d.value, subtotal)), label: `${money(d.value)} korting` };
      else discount = { code: d.code, amount: 0, label: "Gratis verzending" };
    } else if (d.keep) discountNote = d.message;
    else {
      discountNote = d.message;
      code = undefined;
    }
  }

  // verzendkosten: gratis vanaf de drempel (na korting) of met een kortingscode voor gratis verzending
  const afterDiscount = subtotal - (discount?.amount ?? 0);
  const rate = countries.find((c) => c.country === shippingCountry)?.cost ?? 0;
  const from = shop.freeShippingFrom;
  const free = discountType === "shipping" || (from > 0 && afterDiscount >= from);
  const shipping = !live_.length || free ? 0 : rate;
  const freeShippingLeft = !live_.length || free || from <= 0 ? 0 : Math.max(0, from - afterDiscount);
  const total = afterDiscount + shipping;

  // btw: per btw-tarief, met de korting naar rato verdeeld (de laatste groep krijgt het afrondingsverschil, zodat de
  // delen samen precies het bedrag na korting zijn); verzendkosten 21%
  const perRate = new Map<number, number>();
  for (const l of live_) perRate.set(l.vatRate, (perRate.get(l.vatRate) ?? 0) + l.lineTotal);
  const factor = subtotal > 0 ? afterDiscount / subtotal : 0;
  let vat = vatOf(shipping, 21);
  let rest = afterDiscount;
  [...perRate.entries()].forEach(([rate, sum], i, all) => {
    const part = i === all.length - 1 ? rest : Math.min(rest, Math.round(sum * factor));
    rest -= part;
    vat += vatOf(part, rate);
  });

  const cart: Cart = {
    lines,
    count,
    subtotal,
    discount,
    shipping,
    shippingCountry,
    freeShippingLeft,
    total,
    vat,
    discountType,
    discountNote,
    notices: [...new Set(notices)],
    orderable: lines.length > 0 && lines.every((l) => l.inStock) && !input.items.some((i) => (lines.find((l) => l.key === lineKey(i.p, i.v))?.quantity ?? 0) < i.q),
    freeShippingFrom: from,
    countries,
  };
  return { cart, state: { items, ...(code ? { code } : {}), ...(input.country ? { country: shippingCountry } : {}), ...(input.o ? { o: input.o } : {}) } };
}

/** De winkelwagen van deze bezoeker, met actuele prijzen en voorraad uit de database. */
export async function getCart(): Promise<Cart> {
  return (await computeCart(await readCartState())).cart;
}
