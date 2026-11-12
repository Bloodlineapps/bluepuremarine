"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/components/admin/fields";
import { Badge, btnSm } from "@/components/admin/ui";

export type TreeNode = { id: string; name: string; path: string; status: string; highlight: boolean; menuGroup: string; count: number; children: TreeNode[] };

/**
 * Categorieboom (hoofd → sub). Slepen of de pijltjes wijzigt de volgorde binnen hetzelfde niveau en slaat direct op.
 * De selectievakjes horen via form="<formId>" bij de bulkbalk.
 */
export function CategoryTree({ nodes, save, formId }: { nodes: TreeNode[]; save: (ids: string[]) => Promise<ActionResult>; formId: string }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-soft">Sleep een categorie (of gebruik de pijltjes) om de volgorde in het menu te wijzigen. De volgorde wordt direct opgeslagen.</p>
        {msg && (
          <span role="status" className={`text-sm font-medium ${msg.ok ? "text-success" : "text-danger"}`}>
            {msg.text}
          </span>
        )}
      </div>
      {nodes.length ? <Level nodes={nodes} save={save} formId={formId} onSaved={setMsg} /> : <p className="py-6 text-center text-sm text-ink-soft">Nog geen categorieën.</p>}
    </div>
  );
}

function Level({ nodes, save, formId, onSaved, sub }: { nodes: TreeNode[]; save: (ids: string[]) => Promise<ActionResult>; formId: string; onSaved: (m: { ok: boolean; text: string }) => void; sub?: boolean }) {
  const [list, setList] = useState(nodes);
  const [drag, setDrag] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const move = (from: number, to: number) => {
    if (to < 0 || to >= list.length || from === to) return;
    const n = [...list];
    const [x] = n.splice(from, 1);
    n.splice(to, 0, x);
    setList(n);
    start(async () => {
      const res = await save(n.map((c) => c.id));
      onSaved(res.error ? { ok: false, text: res.error } : { ok: true, text: res.message ?? "Volgorde opgeslagen." });
    });
  };
  return (
    <ol className={sub ? "ml-6 mt-1 border-l border-line pl-3 sm:ml-9" : "divide-y divide-line"}>
      {list.map((c, i) => (
        <li
          key={c.id}
          draggable
          onDragStart={(e) => {
            e.stopPropagation();
            setDrag(i);
          }}
          onDragOver={(e) => {
            // alleen een doel voor items uit hetzelfde niveau
            if (drag !== null) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          onDragEnd={(e) => {
            e.stopPropagation();
            setDrag(null);
          }}
          onDrop={(e) => {
            if (drag === null) return;
            e.preventDefault();
            e.stopPropagation();
            move(drag, i);
            setDrag(null);
          }}
          className={`${sub ? "py-1" : "py-2.5"} ${drag === i ? "opacity-50" : ""} ${pending ? "cursor-progress" : ""}`}
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="cursor-grab select-none text-ink-soft" aria-hidden="true">
              ⠿
            </span>
            <input type="checkbox" name="ids" value={c.id} form={formId} className="h-4 w-4" aria-label={`${c.name} selecteren`} />
            <span className="min-w-0 flex-1">
              <Link href={`/admin/categorieen/${c.id}/bewerken/`} className={`hover:underline ${sub ? "" : "font-semibold"}`}>
                {c.name}
              </Link>
              <a href={c.path} target="_blank" className="ml-2 font-mono text-xs text-ink-soft hover:underline">
                {c.path}
              </a>
            </span>
            {c.menuGroup && <span className="text-xs text-ink-soft">{c.menuGroup}</span>}
            {c.highlight && <Badge tone="brand">Accentkleur</Badge>}
            {c.status !== "published" && <Badge tone="warning">Concept</Badge>}
            <span className="w-28 text-right text-xs text-ink-soft">
              {c.count} {c.count === 1 ? "product" : "producten"}
            </span>
            <span className="flex gap-1">
              <button type="button" className={btnSm} onClick={() => move(i, i - 1)} disabled={i === 0 || pending} aria-label={`${c.name} omhoog`}>
                ↑
              </button>
              <button type="button" className={btnSm} onClick={() => move(i, i + 1)} disabled={i === list.length - 1 || pending} aria-label={`${c.name} omlaag`}>
                ↓
              </button>
            </span>
          </div>
          {c.children.length > 0 && <Level nodes={c.children} save={save} formId={formId} onSaved={onSaved} sub />}
        </li>
      ))}
    </ol>
  );
}
