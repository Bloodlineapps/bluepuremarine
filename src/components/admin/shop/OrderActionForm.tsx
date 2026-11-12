"use client";
import { useActionState } from "react";
import { useKeepValues, type ActionResult } from "@/components/admin/fields";
import { btn, btnDanger } from "@/components/admin/ui";

/** Actie op een bestelling (betaald, verzenden, afronden, annuleren, terugbetalen) met bevestiging en de melding van de server. */
export function OrderActionForm({ action, label, confirm, danger, children }: { action: (s: ActionResult, f: FormData) => Promise<ActionResult>; label: string; confirm?: string; danger?: boolean; children?: React.ReactNode }) {
  const [state, formAction, pending] = useActionState(action, {});
  const submit = useKeepValues(formAction);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        // ingevulde waarden (track & trace, bedrag, reden) blijven staan als de server een fout meldt
        if (confirm && !window.confirm(confirm)) e.preventDefault();
        else submit(e);
      }}
      className="space-y-3"
    >
      {children}
      <button className={danger ? `${btnDanger} !px-4 !py-2 !text-sm` : btn} disabled={pending}>
        {pending ? "Bezig…" : label}
      </button>
      {(state.message || state.error) && (
        <p role="status" className={`rounded-xl px-3 py-2 text-sm ${state.error ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>
          {state.error ?? state.message}
        </p>
      )}
    </form>
  );
}
