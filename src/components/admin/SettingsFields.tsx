"use client";
import { useState } from "react";
import { btnDanger, btnSm, input } from "./ui";

type Row = { country: string; label: string; cost: string };

/** Verzendkosten per land als bewerkbare lijst. Bedragen in euro's; de server zet ze om naar centen. */
export function ShippingEditor({ name, value }: { name: string; value: Row[] }) {
  const [rows, setRows] = useState<Row[]>(value.length ? value : [{ country: "NL", label: "Nederland", cost: "" }]);
  const set = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(rows)} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead className="text-xs text-ink-soft">
            <tr>
              <th className="w-24 pb-1.5 pr-2 font-medium">Landcode</th>
              <th className="pb-1.5 pr-2 font-medium">Land (zoals de klant het ziet)</th>
              <th className="w-36 pb-1.5 pr-2 font-medium">Verzendkosten (€)</th>
              <th className="w-10 pb-1.5">
                <span className="sr-only">Verwijderen</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="py-1 pr-2">
                  <input value={r.country} onChange={(e) => set(i, { country: e.target.value.toUpperCase().slice(0, 2) })} placeholder="NL" maxLength={2} className={`${input} font-mono uppercase`} aria-label={`Landcode rij ${i + 1}`} />
                </td>
                <td className="py-1 pr-2">
                  <input value={r.label} onChange={(e) => set(i, { label: e.target.value })} placeholder="Nederland" className={input} aria-label={`Land rij ${i + 1}`} />
                </td>
                <td className="py-1 pr-2">
                  <input value={r.cost} onChange={(e) => set(i, { cost: e.target.value })} placeholder="6,95" inputMode="decimal" className={input} aria-label={`Verzendkosten rij ${i + 1}`} />
                </td>
                <td className="py-1">
                  <button type="button" className={btnDanger} onClick={() => setRows(rows.filter((_, j) => j !== i))} disabled={rows.length === 1} aria-label={`${r.label || "Rij"} verwijderen`}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className={`${btnSm} mt-2`} onClick={() => setRows([...rows, { country: "", label: "", cost: "" }])}>
        + Land toevoegen
      </button>
    </div>
  );
}
