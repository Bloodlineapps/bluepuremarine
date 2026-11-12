import "server-only";
import { cache } from "react";
import type { Page } from "@prisma/client";
import { db } from "./db";
import type { Locale } from "./i18n";
import { GENERIC_BRAND, livePost } from "./shop";

// Zoekt bij een URL-pad de bijbehorende CMS-pagina en levert de lijst van alle indexeerbare URL's (pagina's,
// categorieën, merken, producten en blogs) voor de sitemaps. Menu's verwijzen naar pagina's via hun vaste
// translationKey (bv. "contact", "faq", "privacy"), zodat een link blijft kloppen als de slug verandert.

export const live = { status: "published", deletedAt: null } as const;

export const normalize = (path: string) => {
  let p = path;
  try {
    p = decodeURIComponent(path);
  } catch {
    /* ongeldige codering: pad laten zoals het is */
  }
  p = p.toLowerCase();
  if (!p.startsWith("/")) p = `/${p}`;
  if (!p.endsWith("/")) p += "/";
  return p;
};

export const resolvePath = cache(async (rawPath: string, opts: { preview?: boolean } = {}): Promise<Page | null> => {
  const path = normalize(rawPath);
  return db.page.findFirst({ where: opts.preview ? { path, deletedAt: null } : { path, ...live } });
});

/** Uit de tweetalige basis; de site is alleen Nederlands, dus hooguit { nl: pad }. Het beheer gebruikt dit nog. */
export const translationsOf = cache(async (key: string): Promise<Partial<Record<Locale, string>>> => {
  if (!key) return {};
  const row = await db.page.findFirst({ where: { translationKey: key, ...live }, select: { path: true } });
  return row ? { nl: row.path } : {};
});

export const pageByKey = cache((key: string, _locale?: Locale) => db.page.findFirst({ where: { translationKey: key, ...live } }));

export const pathOf = cache(async (key: string, _locale?: Locale) => (await pageByKey(key))?.path ?? null);

/** Paden van een aantal vaste pagina's in één keer: { contact: "/contact/", faq: "/veelgestelde-vragen/" }. */
export const pagePaths = cache(async (): Promise<Record<string, string>> => {
  const rows = await db.page.findMany({ where: { ...live, translationKey: { not: "" } }, select: { translationKey: true, path: true } });
  return Object.fromEntries(rows.map((r) => [r.translationKey, r.path]));
});

/** Onderliggende pagina's (blok "Onderliggende pagina's"), in de volgorde van het beheer. */
export const childrenOf = cache((key: string, _locale?: Locale) =>
  db.page.findMany({ where: { parentKey: key, ...live, noindex: false }, orderBy: [{ sortOrder: "asc" }, { title: "asc" }], select: { path: true, title: true, navTitle: true, summary: true, translationKey: true, heroImage: true, heroAlt: true } }),
);

export const faqsFor = cache((_locale?: Locale) => db.faq.findMany({ where: live, orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] }));

export type Route = { path: string; updatedAt: Date };
const newest = (rows: Route[]) => rows.reduce<Date | null>((max, r) => (!max || r.updatedAt > max ? r.updatedAt : max), null);

/**
 * Alle indexeerbare publieke URL's met hun echte wijzigingsdatum: bron voor de sitemaps. De overzichten /merken/
 * en /blog/ krijgen de datum van hun nieuwste item.
 */
export async function allRoutes() {
  const [pageRows, categories, products, brandRows, posts] = await Promise.all([
    db.page.findMany({ where: live, select: { path: true, updatedAt: true, noindex: true, translationKey: true, locale: true }, orderBy: { sortOrder: "asc" } }),
    db.category.findMany({ where: { ...live, noindex: false }, select: { path: true, updatedAt: true }, orderBy: [{ sortOrder: "asc" }, { path: "asc" }] }),
    db.product.findMany({ where: { ...live, noindex: false }, select: { path: true, updatedAt: true }, orderBy: { path: "asc" } }),
    db.brand.findMany({ select: { slug: true, updatedAt: true, _count: { select: { products: { where: live } } } }, orderBy: { name: "asc" } }),
    db.post.findMany({ where: { ...livePost(), noindex: false }, select: { path: true, updatedAt: true }, orderBy: { publishedAt: "desc" } }),
  ]);
  const pages: Route[] = pageRows.filter((p) => !p.noindex).map((p) => ({ path: p.path, updatedAt: p.updatedAt }));
  // de homepage hoort er altijd in, ook als er geen CMS-pagina "home" is: dan telt de laatste wijziging van de homepage-instellingen
  if (!pages.some((p) => p.path === "/")) {
    const home = await db.setting.findUnique({ where: { key: "home" }, select: { updatedAt: true } });
    const at = home?.updatedAt ?? newest(products);
    if (at) pages.unshift({ path: "/", updatedAt: at });
  }
  const brandPages: Route[] = brandRows.filter((b) => b._count.products > 0 && b.slug !== GENERIC_BRAND).map((b) => ({ path: `/merken/${b.slug}/`, updatedAt: b.updatedAt }));
  const brandsAt = newest(brandPages);
  const postsAt = newest(posts);
  return {
    pages,
    noindexPages: pageRows.filter((p) => p.noindex),
    categories: categories as Route[],
    products: products as Route[],
    brands: [...(brandsAt ? [{ path: "/merken/", updatedAt: brandsAt }] : []), ...brandPages],
    posts: [...(postsAt ? [{ path: "/blog/", updatedAt: postsAt }] : []), ...(posts as Route[])],
  };
}
