"use client";
import { BulkBar, type BulkOption } from "@/components/admin/BulkBar";
import type { ActionResult } from "@/components/admin/fields";

/**
 * Bulkbalk voor de webshop-overzichten: de gewone BulkBar, met als extra de actie "Exporteren (CSV)".
 * Exporteren downloadt de selectie via `exportUrl` (POST met ids); alle andere acties gaan naar de server action.
 */
export function ShopBulkBar({ formId, action, options, allIds, exportUrl }: { formId: string; action: (s: ActionResult, f: FormData) => Promise<ActionResult>; options: BulkOption[]; allIds: string[]; exportUrl?: string }) {
  const run = async (state: ActionResult, form: FormData): Promise<ActionResult> => {
    if (!exportUrl || form.get("bulk") !== "export") return action(state, form);
    const ids = form.get("scope") === "all" ? allIds : form.getAll("ids").map(String);
    if (!ids.length) return { error: "Selecteer eerst items." };
    const body = new FormData();
    for (const id of ids) body.append("ids", id);
    try {
      const res = await fetch(exportUrl, { method: "POST", body });
      if (!res.ok) return { error: res.status === 401 ? "Je sessie is verlopen. Log opnieuw in." : "Exporteren mislukt." };
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "export.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return { ok: true, message: `${ids.length} ${ids.length === 1 ? "regel" : "regels"} geëxporteerd.` };
    } catch {
      return { error: "Exporteren mislukt." };
    }
  };
  return <BulkBar formId={formId} action={run} allIds={allIds} options={exportUrl ? [...options, { value: "export", label: "Exporteren (CSV)" }] : options} />;
}
