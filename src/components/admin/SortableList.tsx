"use client";
import { useState, useTransition } from "react";
import type { ActionResult } from "./fields";
import { btn, btnSm } from "./ui";

/** Volgorde wijzigen met slepen (of de pijltjes, voor toetsenbord en touch) en daarna opslaan. */
export function SortableList({ items, save }: { items: { id: string; label: string; sub?: string }[]; save: (ids: string[]) => Promise<ActionResult> }) {
  const [list, setList] = useState(items);
  const [drag, setDrag] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const move = (from: number, to: number) => {
    if (to < 0 || to >= list.length) return;
    const n = [...list];
    const [x] = n.splice(from, 1);
    n.splice(to, 0, x);
    setList(n);
    setMsg(null);
  };
  return (
    <div>
      <ol className="divide-y divide-line rounded-xl border border-line">
        {list.map((it, i) => (
          <li
            key={it.id}
            draggable
            onDragStart={() => setDrag(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (drag !== null) move(drag, i);
              setDrag(null);
            }}
            className={`flex items-center gap-3 bg-white px-3 py-2 text-sm ${drag === i ? "opacity-50" : ""}`}
          >
            <span className="cursor-grab select-none text-ink-soft" aria-hidden="true">
              ⠿
            </span>
            <span className="w-6 text-right text-xs text-ink-soft">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{it.label}</span>
              {it.sub && <span className="block truncate text-xs text-ink-soft">{it.sub}</span>}
            </span>
            <button type="button" className={btnSm} onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`${it.label} omhoog`}>
              ↑
            </button>
            <button type="button" className={btnSm} onClick={() => move(i, i + 1)} disabled={i === list.length - 1} aria-label={`${it.label} omlaag`}>
              ↓
            </button>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" className={btn} disabled={pending} onClick={() => start(async () => setMsg((await save(list.map((l) => l.id))).message ?? "Opgeslagen"))}>
          {pending ? "Opslaan…" : "Volgorde opslaan"}
        </button>
        {msg && (
          <span role="status" className="text-sm text-success">
            {msg}
          </span>
        )}
      </div>
    </div>
  );
}
