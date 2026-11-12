"use client";
import { useActionState, useEffect, useState } from "react";
import type { ActionResult } from "./fields";
import { btn, input } from "./ui";

// Actiebalk voor bulkacties. De selectievakjes in de tabel horen via form="<formId>" bij dit formulier.
// Kies "alle resultaten van het filter" om ook items op andere pagina's mee te nemen.

export type BulkOption = { value: string; label: string; confirm?: string };

export function BulkBar({ formId, action, options, allIds }: { formId: string; action: (s: ActionResult, f: FormData) => Promise<ActionResult>; options: BulkOption[]; allIds: string[] }) {
  const [state, formAction, pending] = useActionState(action, {});
  const [choice, setChoice] = useState("");
  const [count, setCount] = useState(0);
  const [scope, setScope] = useState<"page" | "all">("page");
  useEffect(() => {
    const boxes = () => Array.from(document.querySelectorAll<HTMLInputElement>(`input[form="${formId}"][name="ids"]`));
    const update = () => setCount(boxes().filter((b) => b.checked).length);
    document.addEventListener("change", update);
    update();
    return () => document.removeEventListener("change", update);
  }, [state, formId]);
  const toggleAll = (on: boolean) => {
    document.querySelectorAll<HTMLInputElement>(`input[form="${formId}"][name="ids"]`).forEach((b) => (b.checked = on));
    document.dispatchEvent(new Event("change"));
  };
  const selected = scope === "all" ? allIds.length : count;
  const opt = options.find((o) => o.value === choice);
  return (
    <form
      id={formId}
      action={formAction}
      onSubmit={(e) => {
        if (opt?.confirm && !window.confirm(opt.confirm.replace("{n}", String(selected)))) e.preventDefault();
      }}
      className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-3"
    >
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" onChange={(e) => toggleAll(e.target.checked)} aria-label="Alles op deze pagina selecteren" className="h-4 w-4" /> Alles op deze pagina
      </label>
      {allIds.length > 0 && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={scope === "all"} onChange={(e) => setScope(e.target.checked ? "all" : "page")} className="h-4 w-4" /> Alle {allIds.length} resultaten van dit filter
        </label>
      )}
      <input type="hidden" name="scope" value={scope} />
      {scope === "all" && <input type="hidden" name="allIds" value={JSON.stringify(allIds)} />}
      <span className="rounded-full bg-sky px-2.5 py-0.5 text-sm font-medium text-navy" aria-live="polite">
        {selected} geselecteerd
      </span>
      <select name="bulk" value={choice} onChange={(e) => setChoice(e.target.value)} className={`${input} !w-auto`} aria-label="Bulkactie">
        <option value="">Bulkactie kiezen…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button className={btn} disabled={pending || !choice || !selected}>
        {pending ? "Bezig…" : "Toepassen"}
      </button>
      {(state.message || state.error) && (
        <span role="status" className={`text-sm font-medium ${state.error ? "text-danger" : "text-success"}`}>
          {state.error ?? state.message}
        </span>
      )}
    </form>
  );
}
