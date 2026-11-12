import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Icon } from "@/components/Icon";
import { money, toCents } from "@/lib/money";
import { getShop } from "@/lib/settings";
import { SORTS, isSort, listProducts, type ProductFilters, type SortKey } from "@/lib/shop";
import { FilterForm, SortSelect } from "./ListingControls";
import { ProductGrid } from "./ProductCard";

// Productlijst met filters, sortering en paginering, gedeeld door categorie-, merk- en zoekpagina's. Alles staat in
// de URL: ?merk=harken&soort=Blok&min=10&max=200&voorraad=1&sorteer=prijs-oplopend&pagina=2. Pagina 1 heeft geen
// parameter (?pagina=1 → redirect naar de schone URL), een niet-bestaande pagina geeft een 404. Het filter is een
// gewoon GET-formulier met checkboxes, dus het werkt ook zonder JavaScript.

export type SP = Record<string, string | string[] | undefined>;

const many = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []).map((s) => s.trim()).filter(Boolean).slice(0, 30);
const one = (v: string | string[] | undefined) => ((Array.isArray(v) ? v[0] : v) ?? "").trim();

export type ListingState = {
  page: number;
  /** false bij een ongeldige ?pagina= (geen positief getal) → 404 */
  validPage: boolean;
  /** true bij ?pagina=1 → redirect naar de URL zonder parameter */
  pageOne: boolean;
  q: string;
  brands: string[];
  types: string[];
  /** prijs in centen (undefined = geen grens) */
  min?: number;
  max?: number;
  available: boolean;
  sort: SortKey;
  /** er is gefilterd of anders gesorteerd: noindex,follow + canonical naar de schone URL */
  filtered: boolean;
};

export function parseListing(sp: SP): ListingState {
  const p = one(sp.pagina);
  const validPage = sp.pagina === undefined || (!Array.isArray(sp.pagina) && /^[1-9]\d{0,4}$/.test(p));
  const brands = many(sp.merk);
  const types = many(sp.soort);
  const min = one(sp.min) ? (toCents(one(sp.min)) ?? undefined) : undefined;
  const max = one(sp.max) ? (toCents(one(sp.max)) ?? undefined) : undefined;
  const available = one(sp.voorraad) === "1";
  const s = one(sp.sorteer);
  const sort: SortKey = isSort(s) ? s : "populair";
  return {
    page: validPage && p ? Number(p) : 1,
    validPage,
    pageOne: validPage && p === "1",
    q: one(sp.q).slice(0, 80),
    brands,
    types,
    min,
    max,
    available,
    sort,
    filtered: brands.length > 0 || types.length > 0 || min != null || max != null || available || sort !== "populair",
  };
}

const euroInput = (cents?: number) => (cents == null ? "" : (cents / 100).toFixed(cents % 100 ? 2 : 0).replace(".", ","));

/** URL van een lijst met de huidige filters; `page` overschrijft het paginanummer. */
export function listingHref(base: string, s: ListingState, page = s.page, hash = "") {
  const q = new URLSearchParams();
  if (s.q) q.set("q", s.q);
  for (const b of s.brands) q.append("merk", b);
  for (const t of s.types) q.append("soort", t);
  if (s.min != null) q.set("min", euroInput(s.min));
  if (s.max != null) q.set("max", euroInput(s.max));
  if (s.available) q.set("voorraad", "1");
  if (s.sort !== "populair") q.set("sorteer", s.sort);
  if (page > 1) q.set("pagina", String(page));
  const qs = q.toString();
  return `${base}${qs ? `?${qs}` : ""}${hash}`;
}

/** Leest de lijst uit de database; regelt de redirect van ?pagina=1 en de 404 bij een niet-bestaande pagina. */
export async function loadListing(base: string, sp: SP, filters: ProductFilters) {
  const state = parseListing(sp);
  if (!state.validPage) notFound();
  if (state.pageOne) permanentRedirect(listingHref(base, state, 1));
  const shop = await getShop();
  const result = await listProducts({ ...filters, brands: state.brands, types: state.types, min: state.min, max: state.max, available: state.available, sort: state.sort, page: state.page, perPage: shop.perPage });
  if (state.page > result.pages) notFound();
  return { state, result };
}

export type Listing = Awaited<ReturnType<typeof loadListing>>;

// ---------- paginering ----------

function pageNumbers(page: number, pages: number): (number | "…")[] {
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  if (page <= 3) [2, 3, 4].forEach((n) => n <= pages && keep.add(n));
  if (page >= pages - 2) [pages - 1, pages - 2, pages - 3].forEach((n) => n >= 1 && keep.add(n));
  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((n, i) => {
    if (i && n - sorted[i - 1] > 1) out.push("…");
    out.push(n);
  });
  return out;
}

/** Genummerde echte links + vorige/volgende; de huidige pagina is gemarkeerd met aria-current. */
export function Pagination({ page, pages, href, label = "Paginering" }: { page: number; pages: number; href: (page: number) => string; label?: string }) {
  if (pages <= 1) return null;
  const cell = "inline-flex h-11 min-w-11 items-center justify-center rounded-lg border px-3 font-semibold transition-colors";
  const idle = `${cell} border-rule bg-sheet text-ink hover:border-brand hover:text-brand`;
  return (
    <nav aria-label={label} className="mt-10 flex justify-center">
      <ul className="flex flex-wrap items-center justify-center gap-1.5">
        {page > 1 && (
          <li>
            <Link href={href(page - 1)} rel="prev" className={`${idle} gap-1`}>
              <Icon name="chevronLeft" className="h-4 w-4" strokeWidth={2.2} />
              <span>
                Vorige<span className="sr-only"> pagina</span>
              </span>
            </Link>
          </li>
        )}
        {pageNumbers(page, pages).map((n, i) =>
          n === "…" ? (
            <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-muted">
              …
            </li>
          ) : n === page ? (
            <li key={n}>
              <span aria-current="page" className={`${cell} border-brand bg-brand text-white`}>
                <span className="sr-only">Pagina </span>
                {n}
              </span>
            </li>
          ) : (
            <li key={n}>
              <Link href={href(n)} className={idle}>
                <span className="sr-only">Pagina </span>
                {n}
              </Link>
            </li>
          ),
        )}
        {page < pages && (
          <li>
            <Link href={href(page + 1)} rel="next" className={`${idle} gap-1`}>
              <span>
                Volgende<span className="sr-only"> pagina</span>
              </span>
              <Icon name="chevronRight" className="h-4 w-4" strokeWidth={2.2} />
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}

// ---------- lijst met filters ----------

const check = "h-5 w-5 shrink-0 cursor-pointer rounded accent-brand";

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-b border-rule py-4 first:pt-0">
      <legend className="float-left mb-2 w-full text-[0.95rem] font-bold text-ink">{title}</legend>
      <div className="clear-both">{children}</div>
    </fieldset>
  );
}

export function ProductListing({ base, listing, hideBrands = false, title = "Producten", empty }: { base: string; listing: Listing; hideBrands?: boolean; title?: string; empty?: React.ReactNode }) {
  const { state: s, result: r } = listing;
  const f = r.facets;
  const showBrands = !hideBrands && f.brands.length > 1;
  const showTypes = f.types.length > 1;
  const showPrice = f.maxPrice > f.minPrice;
  const hasFilters = showBrands || showTypes || showPrice || s.filtered;
  const clean = listingHref(base, { ...s, brands: [], types: [], min: undefined, max: undefined, available: false, sort: "populair" }, 1, "#producten");
  const activeCount = s.brands.length + s.types.length + (s.min != null ? 1 : 0) + (s.max != null ? 1 : 0) + (s.available ? 1 : 0);

  return (
    <section id="producten" aria-labelledby="producten-titel" className="scroll-mt-4">
      <div className={hasFilters ? "grid gap-x-8 gap-y-4 lg:grid-cols-[15.5rem_minmax(0,1fr)]" : ""}>
        {hasFilters && (
          <aside aria-label="Filters">
            {/* mobiel: uitklapbaar via een checkbox (werkt zonder JavaScript); desktop: altijd zichtbaar */}
            <input type="checkbox" id="filters-open" className="peer sr-only" defaultChecked={false} />
            <label htmlFor="filters-open" className="btn-secondary w-full cursor-pointer peer-focus-visible:shadow-glow lg:hidden">
              <Icon name="sliders" className="h-5 w-5 text-brand" />
              Filters{activeCount > 0 ? ` (${activeCount})` : ""}
            </label>
            <div className="mt-3 hidden rounded-card border border-rule bg-sheet p-4 peer-checked:block lg:mt-0 lg:block">
              <FilterForm id="filters" action={`${base}#producten`}>
                {s.q && <input type="hidden" name="q" value={s.q} />}
                {showBrands && (
                  <FilterGroup title="Merk">
                    <ul className="max-h-64 overflow-y-auto pr-1">
                      {f.brands.map((b) => (
                        <li key={b.slug}>
                          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[0.95rem] lg:min-h-9">
                            <input type="checkbox" name="merk" value={b.slug} defaultChecked={s.brands.includes(b.slug)} className={check} />
                            <span className="flex-1">{b.name}</span>
                            <span className="text-[0.8rem] text-muted tabular-nums">{b.count}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </FilterGroup>
                )}
                {showTypes && (
                  <FilterGroup title="Productsoort">
                    <ul className="max-h-64 overflow-y-auto pr-1">
                      {f.types.map((t) => (
                        <li key={t.name}>
                          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[0.95rem] lg:min-h-9">
                            <input type="checkbox" name="soort" value={t.name} defaultChecked={s.types.includes(t.name)} className={check} />
                            <span className="flex-1">{t.name}</span>
                            <span className="text-[0.8rem] text-muted tabular-nums">{t.count}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </FilterGroup>
                )}
                {(showPrice || s.min != null || s.max != null) && (
                  <FilterGroup title="Prijs">
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label htmlFor="filter-min" className="mb-1 block text-[0.8rem] text-muted">
                          Van (€)
                        </label>
                        <input id="filter-min" name="min" inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" defaultValue={euroInput(s.min)} placeholder={euroInput(Math.floor(f.minPrice / 100) * 100)} className="field h-11 min-h-0 px-2.5" />
                      </div>
                      <div className="flex-1">
                        <label htmlFor="filter-max" className="mb-1 block text-[0.8rem] text-muted">
                          Tot (€)
                        </label>
                        <input id="filter-max" name="max" inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" defaultValue={euroInput(s.max)} placeholder={euroInput(Math.ceil(f.maxPrice / 100) * 100)} className="field h-11 min-h-0 px-2.5" />
                      </div>
                    </div>
                    <p className="mt-1.5 text-[0.8rem] text-muted">
                      {money(f.minPrice)} tot {money(f.maxPrice)}
                    </p>
                  </FilterGroup>
                )}
                <FilterGroup title="Voorraad">
                  <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[0.95rem] lg:min-h-9">
                    <input type="checkbox" name="voorraad" value="1" defaultChecked={s.available} className={check} />
                    Alleen leverbaar
                  </label>
                </FilterGroup>
                <div className="flex flex-col gap-2 pt-4">
                  <button type="submit" className="btn-primary btn-sm w-full">
                    Filters toepassen
                  </button>
                  {s.filtered && (
                    <Link href={clean} className="btn-ghost btn-sm w-full">
                      Wis alle filters
                    </Link>
                  )}
                </div>
              </FilterForm>
            </div>
          </aside>
        )}

        <div>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-rule pb-3">
            <div>
              <h2 id="producten-titel" className="text-[1.15rem]">
                {title}
              </h2>
              <p className="text-[0.9rem] text-muted" role="status">
                Pagina {r.page} van {r.pages}, {r.total} {r.total === 1 ? "product" : "producten"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="sorteer" className="text-[0.9rem] font-semibold text-ink">
                Sorteer op
              </label>
              <SortSelect form={hasFilters ? "filters" : "sorteer-form"} value={s.sort} options={Object.entries(SORTS)} />
              {!hasFilters && (
                <form id="sorteer-form" action={`${base}#producten`} method="get" className="contents">
                  {s.q && <input type="hidden" name="q" value={s.q} />}
                </form>
              )}
              <noscript>
                <button type="submit" form={hasFilters ? "filters" : "sorteer-form"} className="btn-secondary btn-sm">
                  Sorteer
                </button>
              </noscript>
            </div>
          </div>

          {r.items.length > 0 ? (
            <div className="mt-5">
              <ProductGrid products={r.items} cols={hasFilters ? 3 : 4} priorityCount={r.page === 1 ? 4 : 0} />
            </div>
          ) : (
            <div className="mt-6 rounded-card border border-rule bg-paper p-8 text-center">
              {empty ?? (
                <>
                  <p className="text-[1.1rem] font-bold text-ink">Geen producten gevonden</p>
                  <p className="mt-1">{s.filtered ? "Er zijn geen producten die bij deze filters passen." : "In deze categorie staan nog geen producten."}</p>
                </>
              )}
              {s.filtered && (
                <Link href={clean} className="btn-primary mt-5">
                  Wis alle filters
                </Link>
              )}
            </div>
          )}

          <Pagination page={r.page} pages={r.pages} href={(n) => listingHref(base, s, n, "#producten")} label="Paginering van de producten" />
        </div>
      </div>
    </section>
  );
}
