"use client";
import { useActionState, useEffect, useRef, useTransition, useState } from "react";
import { useKeepValues, type ActionResult } from "./fields";
import { btn, btnSm } from "./ui";

/**
 * Compact formulier met melding, voor kleine bewerkingen (status, alt-tekst, redirect, instellingen). Ingevulde
 * waarden blijven na het opslaan staan; met `resetOnSuccess` wordt het formulier na een geslaagde actie geleegd
 * (voor "toevoegen"-formulieren).
 */
export function SimpleForm({ action, children, submitLabel = "Opslaan", className = "", readOnly, resetOnSuccess }: { action: (s: ActionResult, f: FormData) => Promise<ActionResult>; children: React.ReactNode; submitLabel?: string; className?: string; readOnly?: boolean; resetOnSuccess?: boolean }) {
  const [state, formAction, pending] = useActionState(action, {});
  const submit = useKeepValues(formAction);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state.ok) return;
    if (resetOnSuccess) ref.current?.reset();
    // sleutels en wachtwoorden nooit laten staan: na het opslaan is alleen nog de gemaskeerde hint te zien
    ref.current?.querySelectorAll<HTMLInputElement>("input[type=password]").forEach((i) => (i.value = ""));
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} onSubmit={submit} className={className}>
      <fieldset disabled={readOnly} className="space-y-4">
        {(state.message || state.error) && (
          <p role="status" className={`rounded-xl px-4 py-2.5 text-sm ${state.error ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>
            {state.error ?? state.message}
          </p>
        )}
        {children}
        {!readOnly && (
          <button className={btn} disabled={pending}>
            {pending ? "Bezig…" : submitLabel}
          </button>
        )}
      </fieldset>
    </form>
  );
}

/** Knop die een server action zonder formulier uitvoert en het resultaat toont (bv. "Verbinding testen"). */
export function ActionButton({ action, label, disabled }: { action: () => Promise<ActionResult>; label: string; disabled?: boolean }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ActionResult | null>(null);
  return (
    <div className="space-y-2">
      <button type="button" className={btnSm} disabled={pending || disabled} onClick={() => start(async () => setRes(await action()))}>
        {pending ? "Bezig…" : label}
      </button>
      {res && (
        <p role="status" className={`text-xs ${res.error ? "text-danger" : "text-success"}`}>
          {res.error ?? res.message}
        </p>
      )}
    </div>
  );
}

/** Knop voor een server action zonder resultaat (bv. dupliceren, herstellen); werkt ook zonder JavaScript. */
export function ActionForm({ action, label }: { action: () => Promise<void>; label: string }) {
  return (
    <form action={action}>
      <button className={btnSm}>{label}</button>
    </form>
  );
}
