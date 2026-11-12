import "server-only";
import { cache } from "react";
import { db } from "./db";
import type { Locale } from "./i18n";
import { parse } from "./json";
import { pagePaths } from "./content";

// Hoofdmenu en footermenu, te beheren in /admin/menus/. Het megamenu met productcategorieën komt automatisch uit
// categoryTree() (src/lib/shop.ts); het beheerbare hoofdmenu bevat de extra links die daarachter staan (Merken,
// Blog, Klantenservice) en het footermenu de linkkolommen. Een item linkt naar een CMS-pagina via haar
// translationKey (blijft kloppen als de slug verandert) of naar een vaste URL (categorie, merk, account).
// Pagina's die niet (meer) gepubliceerd zijn verdwijnen automatisch uit het menu.

export type MenuNode = { id: string; label: string; key?: string | null; href?: string | null; children?: MenuNode[] };
export type Menus = Record<Locale, { main: MenuNode[]; footer: MenuNode[] }>;
export type MenuLink = { label: string; href: string; external?: boolean; children?: MenuLink[] };

const k = (id: string, label: string, key: string): MenuNode => ({ id, label, key });
const h = (id: string, label: string, href: string): MenuNode => ({ id, label, href });
const col = (id: string, label: string, children: MenuNode[]): MenuNode => ({ id, label, key: null, children });

export const DEFAULT_MENUS: Menus = {
  nl: {
    main: [h("m1", "Merken", "/merken/"), h("m2", "Blog", "/blog/"), k("m3", "Klantenservice", "klantenservice")],
    footer: [
      col("f1", "Populair", [h("f11", "Bestsellers", "/bestsellers/"), h("f12", "Reinigingsproducten", "/onderhoud/reinigingsproducten/"), h("f13", "5 liter deals", "/pakketten/5-liter-deals/"), h("f14", "Boegschroeven", "/bootonderdelen/boegschroeven/"), h("f15", "Ankers en lieren", "/bootonderdelen/ankers-en-lieren/")]),
      col("f2", "Assortiment", [h("f21", "Onderhoud & reiniging", "/onderhoud/"), h("f22", "Bootonderdelen", "/bootonderdelen/"), h("f23", "Navigatie & elektronica", "/navigatie-elektronica/"), h("f24", "Watersport", "/watersport/"), h("f25", "Pakketten & deals", "/pakketten/"), h("f26", "Alle merken", "/merken/")]),
      col("f3", "Informatie", [k("f31", "Over BluePure Marine", "over-ons"), h("f32", "Blog", "/blog/"), k("f33", "Bestellingen en contact", "bestellingen"), k("f34", "Juridische informatie", "legal")]),
      col("f4", "Klantenservice", [k("f41", "Klantenservice", "klantenservice"), k("f42", "Veelgestelde vragen", "faq"), k("f43", "Verzending", "verzending"), k("f44", "Retourbeleid", "retourbeleid"), k("f45", "Contact", "contact")]),
      col("f5", "Mijn account", [h("f51", "Inloggen", "/account/inloggen/"), h("f52", "Mijn bestellingen", "/account/bestellingen/"), h("f53", "Mijn gegevens", "/account/gegevens/"), h("f54", "Winkelwagen", "/winkelwagen/")]),
    ],
  },
};

export const getMenus = cache(async (): Promise<Menus> => {
  const row = await db.setting.findUnique({ where: { key: "menus" } });
  const saved = parse<Partial<Menus>>(row?.value, {});
  return { nl: saved.nl ?? DEFAULT_MENUS.nl };
});

async function resolve(nodes: MenuNode[]): Promise<MenuLink[]> {
  const paths = await pagePaths();
  const out: MenuLink[] = [];
  for (const node of nodes) {
    const href = node.key ? paths[node.key] : node.href || null;
    const children = node.children?.length ? await resolve(node.children) : undefined;
    // een groep zonder eigen link (footerkolom) blijft staan zolang er links in zitten
    if (!href && !(children && children.length)) continue;
    out.push({ label: node.label, href: href ?? "", external: !!href && /^https?:\/\//.test(href), ...(children?.length ? { children } : {}) });
  }
  return out;
}

export const mainMenu = cache(async (_locale: Locale = "nl") => resolve((await getMenus()).nl.main));
export const footerMenu = cache(async (_locale: Locale = "nl") => resolve((await getMenus()).nl.footer));
