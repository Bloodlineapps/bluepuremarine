import "server-only";
import { db } from "./db";
import { live } from "./content";
import type { Crumb } from "./seo";

// Kruimelpaden. "Home" staat er niet in: Breadcrumbs en breadcrumbLd zetten die er altijd voor.

/** CMS-pagina: de parentKey-keten met de korte naam (navTitle) van elke pagina. */
export async function crumbsFor(page: { path: string; title: string; navTitle: string; parentKey: string | null }): Promise<Crumb[]> {
  const chain: Crumb[] = [];
  let key = page.parentKey;
  for (let i = 0; key && key !== "home" && i < 6; i++) {
    const parent = await db.page.findFirst({ where: { translationKey: key, ...live }, select: { path: true, title: true, navTitle: true, parentKey: true } });
    if (!parent) break;
    chain.unshift({ name: parent.navTitle || parent.title, path: parent.path });
    key = parent.parentKey;
  }
  return [...chain, { name: page.navTitle || page.title, path: page.path }];
}

type Cat = { path: string; name: string; navTitle: string };

/** Categorie: Hoofdcategorie › Subcategorie. */
export function categoryCrumbs(cat: Cat & { parent?: Cat | null }): Crumb[] {
  return [...(cat.parent ? [{ name: cat.parent.navTitle || cat.parent.name, path: cat.parent.path }] : []), { name: cat.navTitle || cat.name, path: cat.path }];
}

/** Product: via de primaire categorie (en haar hoofdcategorie), daarna het product zelf. */
export function productCrumbs(p: { path: string; name: string; primaryCategory?: (Cat & { parent?: Cat | null }) | null }): Crumb[] {
  return [...(p.primaryCategory ? categoryCrumbs(p.primaryCategory) : []), { name: p.name, path: p.path }];
}
