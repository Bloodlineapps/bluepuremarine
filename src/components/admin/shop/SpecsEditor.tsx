"use client";
import { useRef, useState } from "react";
import { btnDanger, btnSm, input } from "@/components/admin/ui";

type Row = { k: number; label: string; value: string };

/** Specificaties van een product: bewerkbare lijst label/waarde, volgorde met de pijltjes of door te slepen. */
export function SpecsEditor({ name = "specs", value }: { name?: string; value: { label: string; value: string }[] }) {
  const next = useRef(value.length);
  const [rows, setRows] = useState<Row[]>(value.map((s, k) => ({ k, label: s.label, value: s.value })));
  const [drag, setDrag] = useState<number | null>(null);
  const set = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= rows.length) return;
    const n = [...rows];
    const [x] = n.splice(from, 1);
    n.splice(to, 0, x);
    setRows(n);
  };
  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(rows.map(({ label, value: v }) => ({ label, value: v })))} />
      {rows.length > 0 && (
        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li
              key={r.k}
              draggable
              onDragStart={() => setDrag(i)}
              onDragOver={(e) => e.preventDefault()}
              onDragEnd={() => setDrag(null)}
              onDrop={() => {
                if (drag !== null) move(drag, i);
                setDrag(null);
              }}
              className={`flex flex-wrap items-center gap-2 ${drag === i ? "opacity-50" : ""}`}
            >
              <span className="cursor-grab select-none text-ink-soft" aria-hidden="true">
                ⠿
              </span>
              <input value={r.label} onChange={(e) => set(i, { label: e.target.value })} placeholder="Kenmerk, bv. Inhoud" className={`${input} !w-auto min-w-[140px] flex-1`} aria-label={`Kenmerk ${i + 1}`} />
              <input value={r.value} onChange={(e) => set(i, { value: e.target.value })} placeholder="Waarde, bv. 1 liter" className={`${input} !w-auto min-w-[160px] flex-[2]`} aria-label={`Waarde ${i + 1}`} />
              <button type="button" className={btnSm} onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Omhoog">
                ↑
              </button>
              <button type="button" className={btnSm} onClick={() => move(i, i + 1)} disabled={i === rows.length - 1} aria-label="Omlaag">
                ↓
              </button>
              <button type="button" className={btnDanger} onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Specificatie verwijderen">
                ✕
              </button>
            </li>
          ))}
        </ol>
      )}
      {rows.length === 0 && <p className="text-sm text-ink-soft">Nog geen specificaties. Voeg kenmerken toe zoals inhoud, materiaal of afmetingen; ze staan als tabel op de productpagina.</p>}
      <button type="button" className={`${btnSm} mt-3`} onClick={() => setRows([...rows, { k: next.current++, label: "", value: "" }])}>
        + Specificatie toevoegen
      </button>
    </div>
  );
}
