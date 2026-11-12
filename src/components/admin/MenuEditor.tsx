"use client";
import { useState } from "react";
import type { MenuNode } from "@/lib/menu";
import { AdminForm } from "./fields";
import type { ActionResult } from "./fields";
import { Panel, btnDanger, btnSm, input } from "./ui";

// Menu-editor: hoofdmenu en footermenu samenstellen met slepen (binnen hetzelfde niveau) of de pijltjes,
// items inspringen tot drie niveaus, en per item een pagina (blijft kloppen als de slug wijzigt) of een vrije URL.

type Opt = { value: string; label: string };
const newId = () => Math.random().toString(36).slice(2, 8);

export function MenuEditor({ initial, pages, action, readOnly }: { initial: { main: MenuNode[]; footer: MenuNode[] }; pages: Opt[]; action: (s: ActionResult, f: FormData) => Promise<ActionResult>; readOnly: boolean }) {
  const [main, setMain] = useState(initial.main);
  const [footer, setFooter] = useState(initial.footer);
  return (
    <AdminForm action={action} readOnly={readOnly} aside={<Panel title="Uitleg"><p className="text-sm text-ink-soft">De productcategorieën staan automatisch in het menu; het hoofdmenu hier bevat de extra links erachter (bijvoorbeeld Merken, Blog en Klantenservice), maximaal 7. In het footermenu is het eerste niveau een kolomkop met daaronder de links. Kies bij een link een pagina (blijft kloppen als de URL wijzigt) of vul een vrije URL in, zoals /merken/. Pagina&apos;s die niet gepubliceerd zijn, worden automatisch overgeslagen.</p></Panel>}>
      <input type="hidden" name="menus" value={JSON.stringify({ main, footer })} />
      <Panel title={`Hoofdmenu (${main.length}/7)`}>
        <Tree nodes={main} onChange={setMain} pages={pages} depth={1} max={3} />
      </Panel>
      <Panel title="Footermenu">
        <Tree nodes={footer} onChange={setFooter} pages={pages} depth={1} max={2} />
      </Panel>
    </AdminForm>
  );
}

function Tree({ nodes, onChange, pages, depth, max }: { nodes: MenuNode[]; onChange: (n: MenuNode[]) => void; pages: Opt[]; depth: number; max: number }) {
  const [drag, setDrag] = useState<number | null>(null);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= nodes.length) return;
    const n = [...nodes];
    const [x] = n.splice(from, 1);
    n.splice(to, 0, x);
    onChange(n);
  };
  const set = (i: number, node: MenuNode) => onChange(nodes.map((x, j) => (j === i ? node : x)));
  return (
    <div className={depth > 1 ? "ml-6 mt-2 border-l border-line pl-3" : ""}>
      <ol className="space-y-2">
        {nodes.map((n, i) => (
          <li
            key={n.id}
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              setDrag(i);
            }}
            onDragOver={(e) => drag !== null && e.preventDefault()}
            onDrop={(e) => {
              e.stopPropagation();
              if (drag !== null) move(drag, i);
              setDrag(null);
            }}
            className="rounded-lg border border-line bg-white p-2"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="cursor-grab select-none px-1 text-ink-soft" aria-hidden="true">
                ⠿
              </span>
              <input value={n.label} onChange={(e) => set(i, { ...n, label: e.target.value })} placeholder="Naam" className={`${input} !w-48`} aria-label="Naam van het menu-item" />
              <select
                value={n.key ? `key:${n.key}` : n.href ? "url" : ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v.startsWith("key:")) set(i, { ...n, key: v.slice(4), href: null });
                  else if (v === "url") set(i, { ...n, key: null, href: n.href || "https://" });
                  else set(i, { ...n, key: null, href: null });
                }}
                className={`${input} !w-64`}
                aria-label="Link"
              >
                <option value="">Geen link (alleen kop)</option>
                {pages.map((p) => (
                  <option key={p.value} value={`key:${p.value}`}>
                    {p.label}
                  </option>
                ))}
                <option value="url">Vrije URL…</option>
              </select>
              {!n.key && n.href !== null && n.href !== undefined && <input value={n.href} onChange={(e) => set(i, { ...n, href: e.target.value })} className={`${input} !w-64 font-mono`} aria-label="URL" />}
              <span className="ml-auto flex gap-1">
                <button type="button" className={btnSm} onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`${n.label} omhoog`}>
                  ↑
                </button>
                <button type="button" className={btnSm} onClick={() => move(i, i + 1)} disabled={i === nodes.length - 1} aria-label={`${n.label} omlaag`}>
                  ↓
                </button>
                {depth < max && (
                  <button type="button" className={btnSm} onClick={() => set(i, { ...n, children: [...(n.children ?? []), { id: newId(), label: "", key: null, href: null }] })}>
                    + Subitem
                  </button>
                )}
                <button type="button" className={btnDanger} onClick={() => window.confirm(`"${n.label || "item"}" verwijderen${n.children?.length ? ` met ${n.children.length} subitems` : ""}?`) && onChange(nodes.filter((_, j) => j !== i))}>
                  ✕
                </button>
              </span>
            </div>
            {!!n.children?.length && <Tree nodes={n.children} onChange={(c) => set(i, { ...n, children: c })} pages={pages} depth={depth + 1} max={max} />}
          </li>
        ))}
      </ol>
      <button type="button" className={`${btnSm} mt-2`} onClick={() => onChange([...nodes, { id: newId(), label: "", key: null, href: null }])}>
        + Item {depth > 1 ? "op dit niveau" : ""}
      </button>
    </div>
  );
}
