import "server-only";
import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { parse } from "./json";
import { like } from "./search";

// Leeslaag van de webshop: categorieën, producten, merken en reviews. Storefront, winkelwagen en beheer lezen via
// deze functies, zodat "wat is zichtbaar" (gepubliceerd, niet in de prullenbak) op één plek staat.
// URL's: categorie = Category.path (/onderhoud/ of /onderhoud/reinigingsproducten/), product = /producten/<slug>/,
// merk = /merken/<slug>/, blog = /blog/<slug>/. Pagineren met ?pagina=2 (pagina 1 heeft geen parameter).

export const live = { status: "published", deletedAt: null } as const;

export type ProductImage = { src: string; alt: string; width?: number; height?: number };
export type Spec = { label: string; value: string };

export const imagesOf = (p: { images: string }) => parse<ProductImage[]>(p.images, []);
export const specsOf = (p: { specs: string }) => parse<Spec[]>(p.specs, []);

/** Slug van het verzamelmerk "Overige merken": geen echt merk, dus nergens als merknaam tonen. */
export const GENERIC_BRAND = "overig";
/** Het merk van een product, of null als het ontbreekt of het verzamelmerk is. */
export const realBrand = <B extends { slug: string }>(brand: B | null | undefined): B | null => (brand && brand.slug !== GENERIC_BRAND ? brand : null);

/** Leverbaar? Zonder voorraadbeheer altijd; anders alleen bij voorraad. Uitverkocht blijft zichtbaar. */
export const inStock = (p: { trackStock: boolean; stock: number }) => !p.trackStock || p.stock > 0;

// ---------- categorieën ----------

export type CategoryNode = { id: string; path: string; name: string; navTitle: string; menuGroup: string; highlight: boolean; image: string | null; imageAlt: string; intro: string; count: number; children: CategoryNode[] };

/** Aantal zichtbare producten per categorie (een hoofdcategorie telt ook de producten van haar subcategorieën). */
const productCounts = cache(async () => {
  const rows = await db.productCategory.findMany({ where: { product: live }, select: { categoryId: true, productId: true } });
  const map = new Map<string, Set<string>>();
  for (const r of rows) (map.get(r.categoryId) ?? map.set(r.categoryId, new Set()).get(r.categoryId)!).add(r.productId);
  return map;
});

/** Hoofdcategorieën met hun subcategorieën, in menuvolgorde. Bron voor het megamenu, de footer en de homepage. */
export const categoryTree = cache(async (): Promise<CategoryNode[]> => {
  const [rows, counts] = await Promise.all([db.category.findMany({ where: live, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }), productCounts()]);
  const node = (c: (typeof rows)[number]): CategoryNode => {
    const children = rows.filter((r) => r.parentId === c.id).map(node);
    const ids = new Set(counts.get(c.id) ?? []);
    for (const ch of children) for (const id of counts.get(ch.id) ?? []) ids.add(id);
    return { id: c.id, path: c.path, name: c.name, navTitle: c.navTitle || c.name, menuGroup: c.menuGroup, highlight: c.highlight, image: c.image, imageAlt: c.imageAlt, intro: c.intro, count: ids.size, children };
  };
  return rows.filter((r) => !r.parentId).map(node);
});

export const categoryByPath = cache((path: string) => db.category.findFirst({ where: { path, ...live }, include: { parent: true, children: { where: live, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } } }));

// ---------- producten ----------

/** Velden voor een productkaart. */
export const cardSelect = {
  id: true,
  slug: true,
  path: true,
  name: true,
  subtitle: true,
  images: true,
  price: true,
  compareAtPrice: true,
  stock: true,
  trackStock: true,
  productType: true,
  featured: true,
  publishedAt: true,
  brand: { select: { name: true, slug: true } },
  _count: { select: { variants: true } },
} satisfies Prisma.ProductSelect;
export type ProductCardData = Prisma.ProductGetPayload<{ select: typeof cardSelect }>;

export const SORTS = { populair: "Populariteit", "prijs-oplopend": "Prijs laag - hoog", "prijs-aflopend": "Prijs hoog - laag", nieuwste: "Nieuwste", naam: "Naam A - Z" } as const;
export type SortKey = keyof typeof SORTS;
export const isSort = (v: string): v is SortKey => v in SORTS;

const ORDER: Record<SortKey, Prisma.ProductOrderByWithRelationInput[]> = {
  populair: [{ featured: "desc" }, { sold: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
  "prijs-oplopend": [{ price: "asc" }, { name: "asc" }],
  "prijs-aflopend": [{ price: "desc" }, { name: "asc" }],
  nieuwste: [{ publishedAt: "desc" }, { name: "asc" }],
  naam: [{ name: "asc" }],
};

export type ProductFilters = {
  /** categorie-id's (hoofdcategorie: geef ook de id's van de subcategorieën mee) */
  categoryIds?: string[];
  brandId?: string;
  /** zoekterm (naam, ondertitel, SKU, merk, productsoort) */
  q?: string;
  /** filter: merk-slugs */
  brands?: string[];
  /** filter: productsoorten */
  types?: string[];
  /** filter: prijs in centen */
  min?: number;
  max?: number;
  /** filter: alleen leverbaar */
  available?: boolean;
  sort?: SortKey;
  page?: number;
  perPage?: number;
};

export type Facets = { brands: { slug: string; name: string; count: number }[]; types: { name: string; count: number }[]; minPrice: number; maxPrice: number };

function baseWhere(f: ProductFilters): Prisma.ProductWhereInput {
  const q = f.q?.trim();
  return {
    ...live,
    ...(f.categoryIds?.length ? { categories: { some: { categoryId: { in: f.categoryIds } } } } : {}),
    ...(f.brandId ? { brandId: f.brandId } : {}),
    ...(q ? { OR: [{ name: like(q) }, { subtitle: like(q) }, { sku: like(q) }, { productType: like(q) }, { brand: { name: like(q) } }] } : {}),
  };
}

/**
 * Productoverzicht met filters, sortering en paginering. `facets` wordt berekend over de lijst zónder de gekozen
 * filters (zodat alle keuzes zichtbaar blijven); `total` en `items` mét filters.
 */
export async function listProducts(f: ProductFilters) {
  const perPage = f.perPage ?? 12;
  const page = Math.max(1, f.page ?? 1);
  const base = baseWhere(f);
  const where: Prisma.ProductWhereInput = {
    AND: [
      base,
      f.brands?.length ? { brand: { slug: { in: f.brands } } } : {},
      f.types?.length ? { productType: { in: f.types } } : {},
      f.min != null || f.max != null ? { price: { ...(f.min != null ? { gte: f.min } : {}), ...(f.max != null ? { lte: f.max } : {}) } } : {},
      f.available ? { OR: [{ trackStock: false }, { stock: { gt: 0 } }] } : {},
    ],
  };
  const sort = f.sort ?? "populair";
  // Binnen één categorie (zonder subcategorieën) telt bij "populair" eerst de handmatige volgorde uit het beheer
  // (ProductCategory.position); bij gelijke positie en in alle andere gevallen geldt de gewone volgorde.
  const manualIn = sort === "populair" && f.categoryIds?.length === 1 ? f.categoryIds[0] : null;
  const findItems = manualIn
    ? db.productCategory
        .findMany({
          where: { categoryId: manualIn, product: where },
          orderBy: [{ position: "asc" }, { product: { featured: "desc" } }, { product: { sold: "desc" } }, { product: { sortOrder: "asc" } }, { product: { name: "asc" } }],
          skip: (page - 1) * perPage,
          take: perPage,
          select: { product: { select: cardSelect } },
        })
        .then((rows) => rows.map((r) => r.product))
    : db.product.findMany({ where, select: cardSelect, orderBy: ORDER[sort], skip: (page - 1) * perPage, take: perPage });
  const [items, total, all] = await Promise.all([
    findItems,
    db.product.count({ where }),
    db.product.findMany({ where: base, select: { price: true, productType: true, brand: { select: { slug: true, name: true } } } }),
  ]);
  const brands = new Map<string, { slug: string; name: string; count: number }>();
  const types = new Map<string, number>();
  for (const p of all) {
    if (p.brand && p.brand.slug !== GENERIC_BRAND) brands.set(p.brand.slug, { ...p.brand, count: (brands.get(p.brand.slug)?.count ?? 0) + 1 });
    if (p.productType) types.set(p.productType, (types.get(p.productType) ?? 0) + 1);
  }
  const prices = all.map((p) => p.price);
  const facets: Facets = {
    brands: [...brands.values()].sort((a, b) => a.name.localeCompare(b.name, "nl")),
    types: [...types.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, "nl")),
    minPrice: prices.length ? Math.min(...prices) : 0,
    maxPrice: prices.length ? Math.max(...prices) : 0,
  };
  return { items, total, page, perPage, pages: Math.max(1, Math.ceil(total / perPage)), facets };
}

export const productBySlug = cache((slug: string, opts: { preview?: boolean } = {}) =>
  db.product.findFirst({
    where: opts.preview ? { slug, deletedAt: null } : { slug, ...live },
    include: { brand: true, primaryCategory: { include: { parent: true } }, variants: { orderBy: { sortOrder: "asc" } }, categories: { include: { category: true } } },
  }),
);

/** Losse lijst voor blokken op de homepage (bestsellers, uitgelicht, nieuw). */
export const productsFor = cache((kind: "featured" | "new" | "sale", take = 8) =>
  db.product.findMany({
    where: { ...live, ...(kind === "featured" ? { featured: true } : kind === "sale" ? { compareAtPrice: { not: null } } : {}) },
    select: cardSelect,
    orderBy: kind === "new" ? [{ publishedAt: "desc" }] : [{ sold: "desc" }, { sortOrder: "asc" }],
    take,
  }),
);

/**
 * Gerelateerde producten: zelfde hoofdcategorie, anders zelfde merk. Niet steeds dezelfde bestsellers, maar de
 * producten die in de vaste volgorde van de categorie ná dit product komen (rondlopend). Zo krijgt elk product
 * evenveel interne links van zijn buren en blijft er geen product over waar bijna niets naar verwijst.
 */
export async function relatedProducts(p: { id: string; primaryCategoryId: string | null; brandId: string | null }, take = 4) {
  let same: ProductCardData[] = [];
  if (p.primaryCategoryId) {
    const ring = await db.product.findMany({ where: { ...live, categories: { some: { categoryId: p.primaryCategoryId } } }, select: { id: true }, orderBy: [{ sold: "desc" }, { sortOrder: "asc" }, { id: "asc" }] });
    const at = ring.findIndex((r) => r.id === p.id);
    const others = (at < 0 ? ring : [...ring.slice(at + 1), ...ring.slice(0, at)]).map((r) => r.id).slice(0, take);
    const rows = others.length ? await db.product.findMany({ where: { id: { in: others } }, select: cardSelect }) : [];
    same = others.map((id) => rows.find((r) => r.id === id)).filter((r): r is ProductCardData => !!r);
  }
  if (same.length >= take || !p.brandId) return same;
  const more = await db.product.findMany({ where: { ...live, id: { notIn: [p.id, ...same.map((s) => s.id)] }, brandId: p.brandId }, select: cardSelect, take: take - same.length });
  return [...same, ...more];
}

/** Vaak samen gekocht: andere producten uit bestellingen waarin dit product zat (leeg zolang er geen orders zijn). */
export async function boughtTogether(productId: string, take = 4) {
  const orders = await db.orderItem.findMany({ where: { productId, order: { paymentStatus: "paid" } }, select: { orderId: true }, take: 200 });
  if (!orders.length) return [];
  const others = await db.orderItem.groupBy({ by: ["productId"], where: { orderId: { in: orders.map((o) => o.orderId) }, productId: { not: productId } }, _count: { productId: true }, orderBy: { _count: { productId: "desc" } }, take: take * 2 });
  const ids = others.map((o) => o.productId).filter((id): id is string => !!id);
  const rows = await db.product.findMany({ where: { ...live, id: { in: ids } }, select: cardSelect });
  return ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is ProductCardData => !!r).slice(0, take);
}

// ---------- merken ----------

export const brandsWithProducts = cache(async () => {
  const rows = await db.brand.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { products: { where: live } } } } });
  return rows.filter((b) => b._count.products > 0 && b.slug !== GENERIC_BRAND);
});
export const brandBySlug = cache((slug: string) => db.brand.findUnique({ where: { slug } }));

// ---------- reviews ----------

export type ReviewSummary = { count: number; average: number };

/** Gemiddelde en aantal van de goedgekeurde reviews (van één product, of van de hele winkel). */
export const reviewSummary = cache(async (productId?: string): Promise<ReviewSummary> => {
  const r = await db.review.aggregate({ where: { status: "approved", ...(productId ? { productId } : {}) }, _avg: { rating: true }, _count: true });
  return { count: r._count, average: r._avg.rating ? Math.round(r._avg.rating * 10) / 10 : 0 };
});

export const approvedReviews = cache((productId?: string, take = 12) =>
  db.review.findMany({ where: { status: "approved", ...(productId ? { productId } : {}) }, orderBy: { date: "desc" }, take, include: { product: { select: { name: true, path: true } } } }),
);

// ---------- blog ----------

export const livePost = () => ({ status: "published", deletedAt: null, publishedAt: { lte: new Date() } }) as const;
export const postBySlug = cache((slug: string) => db.post.findFirst({ where: { slug, ...livePost() }, include: { category: true } }));
export const latestPosts = cache((take = 3) => db.post.findMany({ where: livePost(), orderBy: { publishedAt: "desc" }, take, include: { category: true } }));
