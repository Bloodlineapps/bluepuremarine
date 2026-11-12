import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/orders";
import { like } from "@/lib/search";
import { csvName, csvResponse, toCsv } from "./csv";
import { addressOf, euros, fullName } from "./format";

// Filters van de overzichten in het webshopbeheer. De overzichtspagina's en de CSV-exports gebruiken dezelfde
// functies, zodat een export precies de gefilterde lijst bevat.

type Filters = Record<string, string | undefined>;

/** Filters uit de query van een export-URL (zelfde namen als in het overzicht). */
export function filtersFromUrl(url: URL, names: string[]) {
  return { q: (url.searchParams.get("q") ?? "").trim().slice(0, 100), filters: Object.fromEntries(names.map((n) => [n, url.searchParams.get(n) ?? ""]).filter(([, v]) => v)) as Record<string, string> };
}

/** Querystring van het huidige overzicht, voor de link "Exporteer als CSV". */
export const exportQuery = (q: string, filters: Record<string, string>) => {
  const qs = new URLSearchParams({ ...(q ? { q } : {}), ...filters }).toString();
  return qs ? `?${qs}` : "";
};

// ---------- producten ----------
export const PRODUCT_FILTERS = ["status", "merk", "categorie", "voorraad"];

export async function productWhere(q: string, f: Filters): Promise<Prisma.ProductWhereInput> {
  const catIds = f.categorie ? [f.categorie, ...(await db.category.findMany({ where: { parentId: f.categorie }, select: { id: true } })).map((c) => c.id)] : [];
  const stock: Prisma.ProductWhereInput = f.voorraad === "op-voorraad" ? { OR: [{ trackStock: false }, { stock: { gt: 0 } }] } : f.voorraad === "uitverkocht" ? { trackStock: true, stock: { lte: 0 } } : f.voorraad === "bijna-op" ? { trackStock: true, stock: { gt: 0, lte: 3 } } : {};
  return {
    AND: [
      { deletedAt: null },
      q ? { OR: [{ name: like(q) }, { sku: like(q) }, { ean: like(q) }, { slug: like(q) }, { brand: { name: like(q) } }] } : {},
      f.status ? { status: f.status } : {},
      f.merk === "geen" ? { brandId: null } : f.merk ? { brandId: f.merk } : {},
      catIds.length ? { categories: { some: { categoryId: { in: catIds } } } } : {},
      stock,
    ],
  };
}

/** Hoofdcategorieën met hun subcategorieën (ook concepten), voor filters en keuzelijsten in het beheer. */
export async function categoryOptions() {
  const rows = await db.category.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, parentId: true } });
  return rows.filter((r) => !r.parentId).map((c) => ({ id: c.id, name: c.name, children: rows.filter((r) => r.parentId === c.id).map((s) => ({ id: s.id, name: s.name })) }));
}

/** Keuzelijsten voor het productformulier: merken, categorieboom en de bestaande productsoorten. */
export async function productFormOptions() {
  const [brands, categories, types] = await Promise.all([
    db.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    categoryOptions(),
    db.product.findMany({ where: { deletedAt: null, NOT: { productType: "" } }, distinct: ["productType"], select: { productType: true }, orderBy: { productType: "asc" } }),
  ]);
  return { brands, categories, types: types.map((t) => t.productType) };
}

export const PRODUCT_CSV_HEADER = ["slug", "naam", "sku", "ean", "merk", "productsoort", "categoriepaden", "prijs", "van-prijs", "btw", "voorraad", "status", "gewicht", "meta-title", "meta-description"];

export async function productsCsv(where: Prisma.ProductWhereInput) {
  const rows = await db.product.findMany({ where, orderBy: { name: "asc" }, include: { brand: { select: { name: true } }, primaryCategory: { select: { path: true } }, categories: { include: { category: { select: { path: true } } }, orderBy: { category: { path: "asc" } } } } });
  return csvResponse(
    csvName("producten"),
    toCsv(
      PRODUCT_CSV_HEADER,
      rows.map((p) => {
        // de hoofdcategorie staat altijd vooraan
        const paths = [...new Set([p.primaryCategory?.path, ...p.categories.map((c) => c.category.path)].filter((x): x is string => !!x))];
        return [p.slug, p.name, p.sku, p.ean, p.brand?.name, p.productType, paths.join("|"), euros(p.price), euros(p.compareAtPrice), p.vatRate, p.stock, p.status, p.weight, p.metaTitle, p.metaDescription];
      }),
    ),
  );
}

// ---------- bestellingen ----------
export const ORDER_FILTERS = ["status", "betaling", "periode"];
export const PERIODS: Record<string, string> = { vandaag: "Vandaag", "7d": "Laatste 7 dagen", "30d": "Laatste 30 dagen", "90d": "Laatste 90 dagen", jaar: "Dit jaar" };

function since(period?: string) {
  const now = new Date();
  if (period === "vandaag") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "jaar") return new Date(now.getFullYear(), 0, 1);
  const days = parseInt(period ?? "", 10);
  return days > 0 ? new Date(now.getTime() - days * 86_400_000) : null;
}

export function orderWhere(q: string, f: Filters): Prisma.OrderWhereInput {
  const from = since(f.periode);
  return {
    AND: [
      q ? { OR: [{ number: like(q) }, { email: like(q) }, { shippingAddress: like(q) }, { billingAddress: like(q) }, { customer: { OR: [{ firstName: like(q) }, { lastName: like(q) }] } }] } : {},
      f.status ? { status: f.status } : {},
      f.betaling ? { paymentStatus: f.betaling } : {},
      from ? { createdAt: { gte: from } } : {},
    ],
  };
}

// "2026-03-01 14:05" in Nederlandse tijd
const stampFmt = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam", dateStyle: "short", timeStyle: "short" });
const stamp = (d: Date | null) => (d ? stampFmt.format(d) : "");

export async function ordersCsv(where: Prisma.OrderWhereInput) {
  const rows = await db.order.findMany({ where, orderBy: { createdAt: "desc" }, include: { items: true } });
  return csvResponse(
    csvName("bestellingen"),
    toCsv(
      ["nummer", "datum", "status", "betaalstatus", "betaalwijze", "naam", "bedrijf", "e-mail", "telefoon", "straat", "huisnummer", "postcode", "plaats", "land", "artikelen", "subtotaal", "verzendkosten", "kortingscode", "korting", "totaal", "waarvan btw", "terugbetaald", "betaald op", "verzonden op", "track & trace"],
      rows.map((o) => {
        const a = addressOf(o.shippingAddress);
        return [
          o.number,
          stamp(o.createdAt),
          ORDER_STATUS[o.status]?.label ?? o.status,
          PAYMENT_STATUS[o.paymentStatus]?.label ?? o.paymentStatus,
          [o.paymentProvider, o.paymentMethod].filter(Boolean).join(" / "),
          fullName(a),
          a.company,
          o.email,
          o.phone,
          a.street,
          [a.houseNumber, a.addition].filter(Boolean).join(" "),
          a.postalCode,
          a.city,
          a.country,
          o.items.map((i) => `${i.quantity} x ${i.name}${i.variantName ? ` (${i.variantName})` : ""}`).join(" | "),
          euros(o.subtotal),
          euros(o.shippingCost),
          o.discountCode,
          euros(o.discountAmount),
          euros(o.total),
          euros(o.vatAmount),
          euros(o.refundedAmount),
          stamp(o.paidAt),
          stamp(o.shippedAt),
          o.trackingCode,
        ];
      }),
    ),
  );
}

// ---------- klanten ----------
export const CUSTOMER_FILTERS = ["nieuwsbrief"];

export function customerWhere(q: string, f: Filters): Prisma.CustomerWhereInput {
  return { AND: [q ? { OR: [{ email: like(q) }, { firstName: like(q) }, { lastName: like(q) }, { phone: like(q) }] } : {}, f.nieuwsbrief === "ja" ? { newsletter: true } : f.nieuwsbrief === "nee" ? { newsletter: false } : {}] };
}

/** Aantal bestellingen en besteed bedrag (betaald, minus terugbetalingen) per klant. */
export async function customerStats(ids: string[]) {
  const orders = ids.length ? await db.order.findMany({ where: { customerId: { in: ids } }, select: { customerId: true, total: true, refundedAmount: true, paymentStatus: true, status: true } }) : [];
  const map = new Map<string, { count: number; spent: number }>();
  for (const o of orders) {
    const s = map.get(o.customerId!) ?? { count: 0, spent: 0 };
    if (o.status !== "cancelled") s.count++;
    if (["paid", "partially_refunded", "refunded"].includes(o.paymentStatus)) s.spent += o.total - o.refundedAmount;
    map.set(o.customerId!, s);
  }
  return map;
}

export async function customersCsv(where: Prisma.CustomerWhereInput) {
  const rows = await db.customer.findMany({ where, orderBy: { createdAt: "desc" }, include: { addresses: { orderBy: { isDefault: "desc" }, take: 1 } } });
  const stats = await customerStats(rows.map((r) => r.id));
  return csvResponse(
    csvName("klanten"),
    toCsv(
      ["voornaam", "achternaam", "e-mail", "telefoon", "straat", "huisnummer", "postcode", "plaats", "land", "nieuwsbrief", "bestellingen", "totaal besteed", "klant sinds", "laatste login"],
      rows.map((c) => {
        const a = c.addresses[0];
        return [c.firstName, c.lastName, c.email, c.phone, a?.street, a ? [a.houseNumber, a.addition].filter(Boolean).join(" ") : "", a?.postalCode, a?.city, a?.country, c.newsletter, stats.get(c.id)?.count ?? 0, euros(stats.get(c.id)?.spent ?? 0), stamp(c.createdAt), stamp(c.lastLoginAt)];
      }),
    ),
  );
}

// ---------- nieuwsbrief ----------
export const SUBSCRIBER_FILTERS = ["bron"];

export function subscriberWhere(q: string, f: Filters): Prisma.SubscriberWhereInput {
  return { AND: [q ? { email: like(q) } : {}, f.bron ? { source: f.bron } : {}] };
}

export async function subscribersCsv(where: Prisma.SubscriberWhereInput) {
  const rows = await db.subscriber.findMany({ where, orderBy: { createdAt: "desc" } });
  return csvResponse(csvName("nieuwsbrief"), toCsv(["e-mail", "bron", "aangemeld op"], rows.map((s) => [s.email, s.source, stamp(s.createdAt)])));
}
