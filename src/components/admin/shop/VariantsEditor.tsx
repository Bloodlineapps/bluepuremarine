"use client";
import { useRef, useState } from "react";
import { btnDanger, btnSm, input } from "@/components/admin/ui";

export type VariantRow = { id?: string; name: string; options: string[]; price: string; compareAtPrice: string; sku: string; stock: string };
type Row = VariantRow & { k: number };

/**
 * Varianten van een product: eerst de optienamen (bv. Inhoud of Maat en Kleur), daarna per variant de waarden,
 * prijs, van-prijs, SKU en voorraad. De server berekent de productprijs (laagste) en -voorraad (som).
 */
export function VariantsEditor({ optionNames, variants }: { optionNames: string[]; variants: VariantRow[] }) {
  const next = useRef(variants.length);
  const [names, setNames] = useState(optionNames);
  const [rows, setRows] = useState<Row[]>(variants.map((v, k) => ({ ...v, k })));
  const set = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= rows.length) return;
    const n = [...rows];
    const [x] = n.splice(from, 1);
    n.splice(to, 0, x);
    setRows(n);
  };
  const addRow = () => {
    const last = rows[rows.length - 1];
    setRows([...rows, { k: next.current++, name: "", options: names.map(() => ""), price: last?.price ?? "", compareAtPrice: "", sku: "", stock: "0" }]);
  };
  const removeName = (i: number) => {
    setNames(names.filter((_, j) => j !== i));
    setRows(rows.map((r) => ({ ...r, options: r.options.filter((_, j) => j !== i) })));
  };
  const auto = (r: Row) => r.options.filter((o) => o.trim()).join(" / ");
  return (
    <div className="space-y-4">
      <input type="hidden" name="optionNames" value={JSON.stringify(names)} />
      <input type="hidden" name="variants" value={JSON.stringify(rows.map(({ k: _k, ...r }) => r))} />
      <p className="text-sm text-ink-soft">Alleen nodig als de klant moet kiezen, bijvoorbeeld tussen 500 ml en 1 liter. Zonder varianten gelden de prijs en voorraad hierboven.</p>
      <div>
        <span className="mb-1.5 block text-xs font-medium text-ink-soft">Opties waaruit de klant kiest (maximaal 3)</span>
        <div className="flex flex-wrap items-center gap-2">
          {names.map((n, i) => (
            <span key={i} className="flex items-center gap-1">
              <input value={n} onChange={(e) => setNames(names.map((x, j) => (j === i ? e.target.value : x)))} placeholder={["Inhoud", "Kleur", "Maat"][i]} className={`${input} !w-36`} aria-label={`Naam van optie ${i + 1}`} />
              <button type="button" className={btnDanger} onClick={() => removeName(i)} aria-label={`Optie ${n || i + 1} verwijderen`}>
                ✕
              </button>
            </span>
          ))}
          {names.length < 3 && (
            <button
              type="button"
              className={btnSm}
              onClick={() => {
                setNames([...names, ""]);
                setRows(rows.map((r) => ({ ...r, options: [...r.options, ""] })));
              }}
            >
              + Optie
            </button>
          )}
        </div>
      </div>
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs text-ink-soft">
              <tr>
                {names.map((n, i) => (
                  <th key={i} scope="col" className="pb-1.5 pr-2 font-medium">
                    {n || `Optie ${i + 1}`}
                  </th>
                ))}
                <th scope="col" className="pb-1.5 pr-2 font-medium">
                  Naam
                </th>
                <th scope="col" className="pb-1.5 pr-2 font-medium">
                  Prijs (€)
                </th>
                <th scope="col" className="pb-1.5 pr-2 font-medium">
                  Van-prijs (€)
                </th>
                <th scope="col" className="pb-1.5 pr-2 font-medium">
                  SKU
                </th>
                <th scope="col" className="pb-1.5 pr-2 font-medium">
                  Voorraad
                </th>
                <th scope="col" className="pb-1.5 font-medium">
                  <span className="sr-only">Volgorde en verwijderen</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.k} className="align-top">
                  {names.map((n, j) => (
                    <td key={j} className="pb-2 pr-2">
                      <input value={r.options[j] ?? ""} onChange={(e) => set(i, { options: names.map((_, x) => (x === j ? e.target.value : (r.options[x] ?? ""))) })} className={input} aria-label={`${n || `Optie ${j + 1}`} van variant ${i + 1}`} />
                    </td>
                  ))}
                  <td className="pb-2 pr-2">
                    <input value={r.name} onChange={(e) => set(i, { name: e.target.value })} placeholder={auto(r) || "Naam van de variant"} className={input} aria-label={`Naam van variant ${i + 1}`} />
                  </td>
                  <td className="w-24 pb-2 pr-2">
                    <input value={r.price} onChange={(e) => set(i, { price: e.target.value })} inputMode="decimal" placeholder="0,00" className={input} aria-label={`Prijs van variant ${i + 1}`} />
                  </td>
                  <td className="w-24 pb-2 pr-2">
                    <input value={r.compareAtPrice} onChange={(e) => set(i, { compareAtPrice: e.target.value })} inputMode="decimal" className={input} aria-label={`Van-prijs van variant ${i + 1}`} />
                  </td>
                  <td className="w-32 pb-2 pr-2">
                    <input value={r.sku} onChange={(e) => set(i, { sku: e.target.value })} className={input} aria-label={`SKU van variant ${i + 1}`} />
                  </td>
                  <td className="w-20 pb-2 pr-2">
                    <input value={r.stock} onChange={(e) => set(i, { stock: e.target.value })} type="number" min={0} className={input} aria-label={`Voorraad van variant ${i + 1}`} />
                  </td>
                  <td className="whitespace-nowrap pb-2">
                    <span className="flex gap-1 pt-0.5">
                      <button type="button" className={btnSm} onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Omhoog">
                        ↑
                      </button>
                      <button type="button" className={btnSm} onClick={() => move(i, i + 1)} disabled={i === rows.length - 1} aria-label="Omlaag">
                        ↓
                      </button>
                      <button type="button" className={btnDanger} onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Variant verwijderen">
                        ✕
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={btnSm} onClick={addRow}>
          + Variant toevoegen
        </button>
        {rows.length > 0 && <span className="text-xs text-ink-soft">Naam leeg = de optiewaarden, bv. &quot;1 liter / Wit&quot;. De prijs (laagste variant) en voorraad (som) van het product worden bij het opslaan automatisch berekend.</span>}
      </div>
    </div>
  );
}
