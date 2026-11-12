"use client";
import { useState, useTransition } from "react";
import type { ActionResult } from "./fields";
import { Badge, btnSm } from "./ui";

// Kaart per koppeling: status (actief / niet ingesteld / fout), aan-uitknop, "Verbinding testen" en de datum
// van de laatste geslaagde test. Het instelformulier zit in de kaart (children).

export type CardStatus = { configured: boolean; enabled: boolean; lastTest?: { ok: boolean; at: string; message: string } };

const fmt = (iso: string) => new Date(iso).toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam", dateStyle: "medium", timeStyle: "short" });

export function ConnectionCard({ title, description, status, toggle, test, children, readOnly }: { title: string; description: string; status: CardStatus; toggle: (on: boolean) => Promise<ActionResult>; test?: () => Promise<ActionResult>; children: React.ReactNode; readOnly?: boolean }) {
  const [pending, start] = useTransition();
  const [enabled, setEnabled] = useState(status.enabled);
  const [msg, setMsg] = useState<ActionResult | null>(null);
  const state = !status.configured ? "niet ingesteld" : status.lastTest && !status.lastTest.ok ? "fout" : enabled ? "actief" : "uit";
  const tone = state === "actief" ? "success" : state === "fout" ? "danger" : state === "uit" ? "warning" : "neutral";
  return (
    <section className="rounded-2xl border border-line bg-white">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line p-5">
        <div>
          <h2 className="flex items-center gap-2 font-sans text-lg font-semibold">
            {title} <Badge tone={tone}>{state}</Badge>
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">{description}</p>
          {status.lastTest && (
            <p className={`mt-2 text-xs ${status.lastTest.ok ? "text-success" : "text-danger"}`}>
              Laatste test {fmt(status.lastTest.at)}: {status.lastTest.message}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {test && (
            <button type="button" className={btnSm} disabled={pending || !status.configured || readOnly} onClick={() => start(async () => setMsg(await test()))}>
              {pending ? "Bezig…" : "Verbinding testen"}
            </button>
          )}
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <span className="sr-only">{title} aan of uit</span>
            <input
              type="checkbox"
              role="switch"
              checked={enabled}
              disabled={pending || readOnly}
              onChange={(e) =>
                start(async () => {
                  const on = e.target.checked;
                  const r = await toggle(on);
                  setMsg(r);
                  if (!r.error) setEnabled(on);
                })
              }
              className="peer sr-only"
            />
            <span aria-hidden="true" className="relative h-6 w-11 rounded-full bg-line transition peer-checked:bg-success peer-focus-visible:ring-2 peer-focus-visible:ring-lilac-700 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
            {enabled ? "Aan" : "Uit"}
          </label>
        </div>
      </header>
      {msg && (
        <p role="status" className={`mx-5 mt-4 rounded-xl px-4 py-2.5 text-sm ${msg.error ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>
          {msg.error ?? msg.message}
        </p>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
