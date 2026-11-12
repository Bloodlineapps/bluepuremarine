"use client";
import { useActionState, useState } from "react";
import type { ActionResult } from "./fields";
import { btn, btnSm, input } from "./ui";

// Meta-title en meta-description direct in een overzicht bekijken en aanpassen (zonder de editor te openen).
const band = (len: number, min: number, max: number) => (len === 0 ? "text-ink-soft" : len < min || len > max ? "text-[#9a6b00]" : "text-success");

export function MetaQuickEdit({ action, metaTitle, metaDescription, fallbackTitle, readOnly }: { action: (s: ActionResult, f: FormData) => Promise<ActionResult>; metaTitle: string | null; metaDescription: string | null; fallbackTitle: string; readOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const [t, setT] = useState(metaTitle ?? "");
  const [d, setD] = useState(metaDescription ?? "");
  const [state, formAction, pending] = useActionState(action, {});
  if (!open)
    return (
      <div className="min-w-[260px] max-w-md space-y-0.5 text-xs">
        <p className="truncate" title={t || `${fallbackTitle} | BluePure Marine`}>
          <span className={`font-medium ${band(t.length, 45, 60)}`}>{t ? `${t.length}` : "auto"}</span> · {t || <span className="text-ink-soft">{fallbackTitle} | BluePure Marine</span>}
        </p>
        <p className="line-clamp-2" title={d}>
          <span className={`font-medium ${band(d.length, 140, 160)}`}>{d ? `${d.length}` : "leeg"}</span> · {d || <span className="text-ink-soft">automatisch uit de tekst</span>}
        </p>
        {!readOnly && (
          <button type="button" onClick={() => setOpen(true)} className="text-lilac-700 underline underline-offset-2">
            Snel bewerken
          </button>
        )}
        {pending && <span className="ml-2 text-ink-soft">opslaan…</span>}
        {!pending && state.ok && <span className="ml-2 text-success">✓ opgeslagen</span>}
        {!pending && state.error && <span className="ml-2 text-danger">{state.error}</span>}
      </div>
    );
  return (
    <form action={async (f) => { formAction(f); setOpen(false); }} className="min-w-[320px] max-w-md space-y-2">
      <label className="block">
        <span className={`text-xs ${band(t.length, 45, 60)}`}>Meta-title · {t.length}/60</span>
        <input name="metaTitle" value={t} onChange={(e) => setT(e.target.value)} placeholder={`${fallbackTitle} | BluePure Marine`} className={`${input} !py-1.5 !text-xs`} />
      </label>
      <label className="block">
        <span className={`text-xs ${band(d.length, 140, 160)}`}>Meta-description · {d.length}/160</span>
        <textarea name="metaDescription" value={d} onChange={(e) => setD(e.target.value)} rows={3} className={`${input} !py-1.5 !text-xs`} />
      </label>
      {state.error && <p className="text-xs text-danger">{state.error}</p>}
      <div className="flex gap-2">
        <button className={`${btn} !px-3 !py-1 !text-xs`} disabled={pending}>
          Opslaan
        </button>
        <button type="button" onClick={() => setOpen(false)} className={btnSm}>
          Annuleren
        </button>
      </div>
    </form>
  );
}
