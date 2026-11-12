"use client";
import { useState, useTransition } from "react";
import type { ImportRow } from "@/app/admin/actions/shop";
import { Badge, Panel, btn, btnSm } from "@/components/admin/ui";

type Preview = { error?: string; rows?: ImportRow[]; csv?: string };
type Report = { error?: string; message?: string; rows?: ImportRow[] };

const LABEL = { create: "Nieuw", update: "Bijwerken", error: "Fout" } as const;
const TONE = { create: "brand", update: "success", error: "danger" } as const;

/** CSV-import in drie stappen: bestand kiezen → voorbeeld van wat er gebeurt → bevestigen en rapport per regel. */
export function ProductImport({ preview, run }: { preview: (f: FormData) => Promise<Preview>; run: (csv: string) => Promise<Report> }) {
  const [plan, setPlan] = useState<Preview | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [pending, start] = useTransition();
  const rows = report?.rows ?? plan?.rows ?? [];
  const count = (a: ImportRow["action"]) => (plan?.rows ?? []).filter((r) => r.action === a).length;
  const reset = () => {
    setPlan(null);
    setReport(null);
  };
  return (
    <div className="space-y-6">
      {!plan?.rows && !report && (
        <Panel title="1. Bestand kiezen">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              start(async () => setPlan(await preview(fd)));
            }}
          >
            <input type="file" name="file" accept=".csv,text/csv" required className="block w-full text-sm" aria-label="CSV-bestand" />
            {plan?.error && (
              <p role="status" className="rounded-xl bg-danger/10 px-4 py-2.5 text-sm text-danger">
                {plan.error}
              </p>
            )}
            <button className={btn} disabled={pending}>
              {pending ? "Bestand controleren…" : "Voorbeeld tonen"}
            </button>
            <p className="text-xs text-ink-soft">Er wordt nog niets gewijzigd: je ziet eerst wat de import gaat doen.</p>
          </form>
        </Panel>
      )}

      {plan?.rows && !report && (
        <Panel title="2. Controleren en bevestigen">
          <p className="text-sm">
            <strong>{count("create")}</strong> nieuwe producten, <strong>{count("update")}</strong> worden bijgewerkt{count("error") > 0 && (
              <>
                , <strong className="text-danger">{count("error")}</strong> regels met een fout (die worden overgeslagen)
              </>
            )}
            .
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={btn}
              disabled={pending || count("create") + count("update") === 0}
              onClick={() => {
                if (window.confirm(`${count("create")} producten aanmaken en ${count("update")} bijwerken?`)) start(async () => setReport(await run(plan.csv ?? "")));
              }}
            >
              {pending ? "Importeren…" : "Import uitvoeren"}
            </button>
            <button type="button" className={btnSm} onClick={reset} disabled={pending}>
              Ander bestand kiezen
            </button>
          </div>
        </Panel>
      )}

      {report && (
        <Panel title="3. Rapport">
          <p role="status" className={`rounded-xl px-4 py-3 text-sm ${report.error ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>
            {report.error ?? `Import klaar: ${report.message}`}
          </p>
          <button type="button" className={`${btnSm} mt-4`} onClick={reset}>
            Nog een bestand importeren
          </button>
        </Panel>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-ink-soft">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Regel
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Slug / SKU
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Naam
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {report ? "Resultaat" : "Actie"}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Toelichting
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.line}>
                  <td className="px-4 py-2 text-ink-soft">{r.line}</td>
                  <td className="px-4 py-2 font-mono text-xs">{r.key || "–"}</td>
                  <td className="px-4 py-2">{r.name || "–"}</td>
                  <td className="px-4 py-2">{report ? r.done ? <Badge tone="success">{r.action === "create" ? "Aangemaakt" : "Bijgewerkt"}</Badge> : <Badge tone="danger">Mislukt</Badge> : <Badge tone={TONE[r.action]}>{LABEL[r.action]}</Badge>}</td>
                  <td className={`px-4 py-2 text-xs ${r.action === "error" ? "text-danger" : "text-ink-soft"}`}>{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
