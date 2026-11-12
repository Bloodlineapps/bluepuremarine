import Link from "next/link";
import { Icon } from "@/components/Icon";
import { btn, input } from "./ui";

// Overzichtstabel met zoeken, filteren, sorteren en paginering via de URL (werkt zonder JavaScript).
export type Column<T> = { key: string; label: string; sortable?: boolean; className?: string; render: (row: T) => React.ReactNode };
export type Filter = { name: string; label: string; options: { value: string; label: string }[] };
export type ListParams = { q: string; page: number; sort: string; dir: "asc" | "desc"; filters: Record<string, string> };

export const PER_PAGE = 25;

export function readParams(sp: Record<string, string | string[] | undefined>, defaults: { sort: string; dir?: "asc" | "desc" }, filterNames: string[] = []): ListParams {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined)) ?? "";
  return {
    q: one("q").trim().slice(0, 100),
    page: Math.max(1, Number(one("pagina")) || 1),
    sort: one("sorteer") || defaults.sort,
    dir: one("richting") === "asc" ? "asc" : one("richting") === "desc" ? "desc" : (defaults.dir ?? "desc"),
    filters: Object.fromEntries(filterNames.map((n) => [n, one(n)]).filter(([, v]) => v)),
  };
}

function href(base: string, p: ListParams, change: Partial<{ page: number; sort: string; dir: string }>) {
  const qs = new URLSearchParams();
  if (p.q) qs.set("q", p.q);
  for (const [k, v] of Object.entries(p.filters)) qs.set(k, v);
  const sort = change.sort ?? p.sort;
  const dir = change.dir ?? p.dir;
  qs.set("sorteer", sort);
  qs.set("richting", dir);
  const page = change.page ?? p.page;
  if (page > 1) qs.set("pagina", String(page));
  return `${base}?${qs.toString()}`;
}

export function DataTable<T extends { id: string }>({ base, params, columns, rows, total, filters = [], newHref, newLabel, searchLabel = "Zoeken", hidden, selectForm, selectValue }: { base: string; params: ListParams; columns: Column<T>[]; rows: T[]; total: number; filters?: Filter[]; newHref?: string; newLabel?: string; searchLabel?: string; hidden?: Record<string, string>; /** id van het bulkformulier: toont een selectievakje per rij */ selectForm?: string; selectValue?: (row: T) => string }) {
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  return (
    <div className="rounded-2xl border border-line bg-white">
      <form action={base} className="flex flex-wrap items-end gap-3 border-b border-line p-4" role="search">
        {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <label className="min-w-[200px] flex-1">
          <span className="sr-only">{searchLabel}</span>
          <input name="q" defaultValue={params.q} placeholder={searchLabel} className={input} type="search" />
        </label>
        {filters.map((f) => (
          <label key={f.name}>
            <span className="sr-only">{f.label}</span>
            <select name={f.name} defaultValue={params.filters[f.name] ?? ""} className={input}>
              <option value="">{f.label}: alle</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ))}
        <input type="hidden" name="sorteer" value={params.sort} />
        <input type="hidden" name="richting" value={params.dir} />
        <button className={btn}>Filter</button>
        {(params.q || Object.keys(params.filters).length > 0) && (
          <Link href={hidden ? `${base}?${new URLSearchParams(hidden)}` : base} className="text-sm underline">
            Wissen
          </Link>
        )}
        {newHref && (
          <Link href={newHref} className={`${btn} ml-auto`}>
            + {newLabel ?? "Nieuw"}
          </Link>
        )}
      </form>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wider text-ink-soft">
            <tr>
              {selectForm && (
                <th scope="col" className="w-10 px-4 py-3">
                  <span className="sr-only">Selecteren</span>
                </th>
              )}
              {columns.map((c) => (
                <th key={c.key} scope="col" className={`px-4 py-3 font-medium ${c.className ?? ""}`} aria-sort={params.sort === c.key ? (params.dir === "asc" ? "ascending" : "descending") : undefined}>
                  {c.sortable ? (
                    <Link href={href(base, params, { sort: c.key, dir: params.sort === c.key && params.dir === "asc" ? "desc" : "asc", page: 1 })} className="inline-flex items-center gap-1 hover:text-ink">
                      {c.label}
                      {params.sort === c.key && <Icon name="chevron" className={`h-3.5 w-3.5 ${params.dir === "asc" ? "rotate-180" : ""}`} />}
                    </Link>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-cream/60">
                {selectForm && (
                  <td className="px-4 py-3 align-middle">
                    <input type="checkbox" name="ids" value={selectValue ? selectValue(r) : r.id} form={selectForm} className="h-4 w-4" aria-label="Selecteren" />
                  </td>
                )}
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 align-middle ${c.className ?? ""}`}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + (selectForm ? 1 : 0)} className="px-4 py-10 text-center text-ink-soft">
                  Niets gevonden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-ink-soft">
        <p>
          {total} resultaten · pagina {params.page} van {pages}
        </p>
        <div className="flex gap-2">
          {params.page > 1 && (
            <Link href={href(base, params, { page: params.page - 1 })} className="rounded-full border border-line px-3 py-1 hover:border-ink">
              Vorige
            </Link>
          )}
          {params.page < pages && (
            <Link href={href(base, params, { page: params.page + 1 })} className="rounded-full border border-line px-3 py-1 hover:border-ink">
              Volgende
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
