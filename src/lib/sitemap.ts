import "server-only";
import { allRoutes, type Route } from "./content";
import { canonical } from "./seo";
import { SITE_URL } from "./settings";

// Sitemaps: /sitemap.xml is een index die verwijst naar vier deelbestanden (pagina's, categorieën + merken,
// producten, blog). Alleen indexeerbare, gepubliceerde URL's, exact gelijk aan hun canonical; lastmod = echte
// wijzigingsdatum; geen changefreq en geen priority.

export const SITEMAPS = { paginas: "/sitemap-paginas.xml", categorieen: "/sitemap-categorieen.xml", producten: "/sitemap-producten.xml", blog: "/sitemap-blog.xml" } as const;
export type SitemapKind = keyof typeof SITEMAPS;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const xml = (body: string) => new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${body}`, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });

async function routesOf(kind: SitemapKind): Promise<Route[]> {
  const r = await allRoutes();
  const rows = kind === "paginas" ? r.pages : kind === "categorieen" ? [...r.categories, ...r.brands] : kind === "producten" ? r.products : r.posts;
  const seen = new Set<string>();
  return rows.filter((x) => !seen.has(x.path) && !!seen.add(x.path));
}

export async function sitemapXml(kind: SitemapKind) {
  const urls = (await routesOf(kind)).map((p) => `<url><loc>${esc(canonical(p.path))}</loc><lastmod>${p.updatedAt.toISOString()}</lastmod></url>`);
  return xml(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`);
}

export async function sitemapIndexXml() {
  const parts = await Promise.all(
    (Object.keys(SITEMAPS) as SitemapKind[]).map(async (kind) => {
      const rows = await routesOf(kind);
      if (!rows.length) return "";
      const last = rows.reduce((max, r) => (r.updatedAt > max ? r.updatedAt : max), rows[0].updatedAt);
      return `<sitemap><loc>${esc(`${SITE_URL}${SITEMAPS[kind]}`)}</loc><lastmod>${last.toISOString()}</lastmod></sitemap>`;
    }),
  );
  return xml(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${parts.filter(Boolean).join("\n")}\n</sitemapindex>`);
}
