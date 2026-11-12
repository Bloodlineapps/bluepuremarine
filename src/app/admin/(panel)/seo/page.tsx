import Link from "next/link";
import { saveMeta, type MetaType } from "@/app/admin/actions/content";
import { MetaQuickEdit } from "@/components/admin/MetaQuickEdit";
import { Badge, PageHeader, Panel, Stat, btn, input } from "@/components/admin/ui";
import { EDIT_URL } from "@/lib/admin/revisions";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = { title: "SEO" };

type Row = { id: string; table: MetaType; title: string; path: string; status: string; metaTitle: string | null; metaDescription: string | null; noindex: boolean };

const TYPES: Record<MetaType, string> = { page: "Pagina", product: "Product", category: "Categorie", post: "Blog" };
const SORTS: Record<string, string> = { pad: "URL", titel: "Titel", "title-lengte": "Lengte meta-title", "desc-lengte": "Lengte meta-description" };
type Dupes = { titles: Set<string>; descriptions: Set<string> };
const ISSUES: Record<string, { label: string; test: (r: Row, d: Dupes) => boolean }> = {
  "desc-leeg": { label: "Meta-description ontbreekt", test: (r) => !r.metaDescription },
  "title-leeg": { label: "Meta-title ontbreekt (automatisch)", test: (r) => !r.metaTitle },
  "desc-lengte": { label: "Description niet 140–160 tekens", test: (r) => !!r.metaDescription && (r.metaDescription.length < 140 || r.metaDescription.length > 160) },
  "title-lengte": { label: "Meta-title niet 45–60 tekens", test: (r) => !!r.metaTitle && (r.metaTitle.length < 45 || r.metaTitle.length > 60) },
  dubbel: { label: "Dubbele meta-title", test: (r, d) => !!r.metaTitle && d.titles.has(r.metaTitle.toLowerCase()) },
  "dubbel-desc": { label: "Dubbele meta-description", test: (r, d) => !!r.metaDescription && d.descriptions.has(r.metaDescription.toLowerCase()) },
  noindex: { label: "Niet geïndexeerd (noindex/concept)", test: (r) => r.noindex || r.status !== "published" },
};
const PER = 50;

/** Waarden die meer dan één keer voorkomen (hoofdletterongevoelig). */
function duplicates(values: (string | null)[]) {
  const seen = new Map<string, number>();
  for (const v of values) if (v) seen.set(v.toLowerCase(), (seen.get(v.toLowerCase()) ?? 0) + 1);
  return new Set([...seen].filter(([, n]) => n > 1).map(([t]) => t));
}

// Eén overzicht van alle URL's (pagina's, producten, categorieën en blogs) met hun meta-gegevens: problemen vinden
// en direct oplossen.
export default async function SeoPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireUser();
  const sp = await searchParams;
  const sel = { id: true, path: true, status: true, metaTitle: true, metaDescription: true, noindex: true } as const;
  const where = { deletedAt: null };
  const [pages, products, categories, posts, redirects] = await Promise.all([
    db.page.findMany({ where, select: { ...sel, title: true } }),
    db.product.findMany({ where, select: { ...sel, name: true } }),
    db.category.findMany({ where, select: { ...sel, name: true } }),
    db.post.findMany({ where, select: { ...sel, title: true } }),
    db.redirect.count(),
  ]);
  const all: Row[] = [
    ...pages.map((r) => ({ ...r, table: "page" as const })),
    ...products.map(({ name, ...r }) => ({ ...r, title: name, table: "product" as const })),
    ...categories.map(({ name, ...r }) => ({ ...r, title: name, table: "category" as const })),
    ...posts.map((r) => ({ ...r, table: "post" as const })),
  ];
  // dubbelen tellen alleen tussen URL's die geïndexeerd kunnen worden
  const indexable = all.filter((r) => !r.noindex && r.status === "published");
  const dupes: Dupes = { titles: duplicates(indexable.map((r) => r.metaTitle)), descriptions: duplicates(indexable.map((r) => r.metaDescription)) };
  const q = (sp.q ?? "").trim().toLowerCase();
  const sort = sp.sorteer && sp.sorteer in SORTS ? sp.sorteer : "pad";
  const dir = sp.richting === "desc" ? -1 : 1;
  const rows = all
    .filter((r) => !sp.type || r.table === sp.type)
    .filter((r) => !sp.probleem || ISSUES[sp.probleem]?.test(r, dupes))
    .filter((r) => !q || r.title.toLowerCase().includes(q) || r.path.includes(q) || (r.metaTitle ?? "").toLowerCase().includes(q) || (r.metaDescription ?? "").toLowerCase().includes(q))
    .sort((a, b) => dir * (sort === "titel" ? a.title.localeCompare(b.title, "nl") : sort === "title-lengte" ? (a.metaTitle?.length ?? 0) - (b.metaTitle?.length ?? 0) : sort === "desc-lengte" ? (a.metaDescription?.length ?? 0) - (b.metaDescription?.length ?? 0) : a.path.localeCompare(b.path)));
  const pageCount = Math.max(1, Math.ceil(rows.length / PER));
  const page = Math.min(pageCount, Math.max(1, Number(sp.pagina) || 1));
  const shown = rows.slice((page - 1) * PER, page * PER);
  const count = (k: string) => all.filter((r) => ISSUES[k].test(r, dupes)).length;
  const qs = (p: Record<string, string | undefined>) => `?${new URLSearchParams(Object.entries({ ...sp, ...p }).filter(([, v]) => v) as [string, string][])}`;
  const filled = all.filter((r) => r.metaDescription).length;

  return (
    <>
      <PageHeader title="SEO-overzicht" description="Alle URL's van de webshop (pagina's, producten, categorieën en blogs) met meta-title en meta-description. Vind ontbrekende, te korte, te lange of dubbele teksten en pas ze direct aan. Advies: title 45–60 tekens, description 140–160 tekens." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="URL's" value={all.length} sub={`${pages.length} pagina's · ${products.length} producten · ${categories.length} categorieën · ${posts.length} blogs · ${redirects} redirects`} />
        <Stat label="Met eigen description" value={all.length ? `${Math.round((filled / all.length) * 100)}%` : "–"} sub={`${filled} van ${all.length}`} />
        <Stat label="Description ontbreekt" value={count("desc-leeg")} href={`/admin/seo/${qs({ probleem: "desc-leeg", pagina: undefined })}`} sub="valt terug op de eerste zin van de tekst" />
        <Stat label="Dubbele titles / descriptions" value={`${count("dubbel")} / ${count("dubbel-desc")}`} href={`/admin/seo/${qs({ probleem: count("dubbel") ? "dubbel" : "dubbel-desc", pagina: undefined })}`} sub="geef elke URL een eigen tekst" />
      </div>

      {(dupes.titles.size > 0 || dupes.descriptions.size > 0) && (
        <p className="mt-4 rounded-xl bg-sun-100 px-4 py-3 text-sm text-[#7a5a10]" role="status">
          Let op: {dupes.titles.size > 0 && `${count("dubbel")} URL's delen een meta-title met een andere URL`}
          {dupes.titles.size > 0 && dupes.descriptions.size > 0 && " en "}
          {dupes.descriptions.size > 0 && `${count("dubbel-desc")} URL's delen een meta-description`}. Zoekmachines kiezen dan zelf welke pagina ze tonen.{" "}
          <Link href={`/admin/seo/?probleem=${dupes.titles.size ? "dubbel" : "dubbel-desc"}`} className="underline">
            Bekijk ze
          </Link>
        </p>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_280px]">
        <div className="min-w-0">
          <form action="/admin/seo/" className="mb-3 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-4" role="search">
            <input name="q" defaultValue={sp.q} placeholder="Zoek op titel, URL of meta-tekst" type="search" className={`${input} min-w-[180px] flex-1`} aria-label="Zoeken" />
            <select name="type" defaultValue={sp.type ?? ""} className={`${input} !w-auto`} aria-label="Type">
              <option value="">Type: alle</option>
              {Object.entries(TYPES).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <select name="probleem" defaultValue={sp.probleem ?? ""} className={`${input} !w-auto`} aria-label="Probleem">
              <option value="">Alle URL&apos;s</option>
              {Object.entries(ISSUES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label} ({count(k)})
                </option>
              ))}
            </select>
            <select name="sorteer" defaultValue={sort} className={`${input} !w-auto`} aria-label="Sorteren op">
              {Object.entries(SORTS).map(([v, l]) => (
                <option key={v} value={v}>
                  Sorteer: {l}
                </option>
              ))}
            </select>
            <select name="richting" defaultValue={sp.richting === "desc" ? "desc" : "asc"} className={`${input} !w-auto`} aria-label="Richting">
              <option value="asc">Oplopend</option>
              <option value="desc">Aflopend</option>
            </select>
            <button className={btn}>Filter</button>
            {(sp.q || sp.type || sp.probleem) && (
              <Link href="/admin/seo/" className="text-sm underline">
                Wissen
              </Link>
            )}
          </form>
          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wider text-ink-soft">
                <tr>
                  <th className="px-4 py-3 font-medium">URL</th>
                  <th className="px-4 py-3 font-medium">Meta-title en -description (aantal tekens)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((r) => (
                  <tr key={`${r.table}-${r.id}`} className="align-top hover:bg-cream/60">
                    <td className="px-4 py-3">
                      <Link href={EDIT_URL[r.table](r.id)} className="font-medium hover:underline">
                        {r.title}
                      </Link>
                      <a href={r.path} target="_blank" className="block font-mono text-xs text-ink-soft hover:underline">
                        {r.path}
                      </a>
                      <span className="mt-1 flex flex-wrap gap-1">
                        <Badge tone={r.table === "page" ? "neutral" : "brand"}>{TYPES[r.table]}</Badge>
                        {r.status !== "published" && <Badge tone="warning">{r.status === "scheduled" ? "ingepland" : "concept"}</Badge>}
                        {r.noindex && <Badge tone="warning">noindex</Badge>}
                        {ISSUES.dubbel.test(r, dupes) && <Badge tone="danger">dubbele title</Badge>}
                        {ISSUES["dubbel-desc"].test(r, dupes) && <Badge tone="danger">dubbele description</Badge>}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <MetaQuickEdit key={`${r.table}-${r.id}`} action={saveMeta.bind(null, r.table, r.id)} metaTitle={r.metaTitle} metaDescription={r.metaDescription} fallbackTitle={r.title} />
                    </td>
                  </tr>
                ))}
                {!shown.length && (
                  <tr>
                    <td colSpan={2} className="px-4 py-10 text-center text-ink-soft">
                      Niets gevonden.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 flex flex-wrap gap-3 text-sm text-ink-soft">
            {rows.length} URL&apos;s · pagina {page} van {pageCount}
            {page > 1 && (
              <Link href={`/admin/seo/${qs({ pagina: String(page - 1) })}`} className="underline">
                Vorige
              </Link>
            )}
            {page < pageCount && (
              <Link href={`/admin/seo/${qs({ pagina: String(page + 1) })}`} className="underline">
                Volgende
              </Link>
            )}
          </p>
        </div>

        <aside className="space-y-6">
          <Panel title="Zo lees je de cijfers">
            <ul className="space-y-2 text-sm text-ink-soft">
              <li>
                <span className="font-medium text-success">Groen</span>: lengte binnen het advies.
              </li>
              <li>
                <span className="font-medium text-[#9a6b00]">Oranje</span>: te kort of te lang.
              </li>
              <li>
                <span className="font-medium text-ink">auto / leeg</span>: niet ingevuld; de site gebruikt dan de titel en de eerste zin van de tekst.
              </li>
            </ul>
          </Panel>
          <Panel title="Handig">
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/sitemap_index.xml" target="_blank" className="underline">
                  XML-sitemap (sitemap_index.xml) ↗
                </a>
              </li>
              <li>
                <a href="/robots.txt" target="_blank" className="underline">
                  robots.txt ↗
                </a>
              </li>
              <li>
                <Link href="/admin/redirects/" className="underline">
                  Redirects en 404-log
                </Link>
              </li>
              <li>
                <Link href="/admin/instellingen/seo/" className="underline">
                  Algemene SEO-instellingen
                </Link>
              </li>
              <li>
                <a href="/admin/export/seo/" className="underline">
                  Alle meta-gegevens exporteren (CSV)
                </a>
              </li>
            </ul>
          </Panel>
        </aside>
      </div>
    </>
  );
}
