"use client";
import { useActionState, useEffect, useRef } from "react";
import { applyDiscountForm, getCartSummary, type DiscountFormState } from "@/app/actions/shop";
import { announceCart } from "./CartIndicator";

// Kleine client-onderdelen van de winkelwagen- en afrekenpagina. De formulieren zelf zijn gewone formulieren met
// server actions (werken ook zonder JavaScript); dit zorgt alleen voor het bijwerken van de header en wat gemak.

/** Meldt de actuele stand aan de header. Met `sync` wordt de cookie op de server eerst opgeschoond. */
export function CartSync({ count, total, sync = false }: { count: number; total: number; sync?: boolean }) {
  useEffect(() => {
    announceCart({ count, total });
    if (sync)
      getCartSummary()
        .then((s) => announceCart({ count: s.count, total: s.total }))
        .catch(() => {});
  }, [count, total, sync]);
  return null;
}

/** Kortingscode invullen, met de foutmelding van de server eronder. */
export function DiscountForm() {
  const [state, action, pending] = useActionState<DiscountFormState, FormData>(applyDiscountForm, {});
  return (
    <form action={action} className="space-y-2">
      <label htmlFor="kortingscode" className="label">
        Kortingscode
      </label>
      <div className="flex gap-2">
        <input id="kortingscode" name="code" className="field min-w-0 flex-1 uppercase placeholder:normal-case" placeholder="Vul je code in" autoComplete="off" autoCapitalize="characters" maxLength={40} aria-invalid={state.ok === false} aria-describedby="kortingscode-melding" />
        <button type="submit" className="btn-secondary shrink-0" disabled={pending}>
          {pending ? "Bezig…" : "Toepassen"}
        </button>
      </div>
      <p id="kortingscode-melding" role="status" aria-live="polite" className={`text-sm font-medium ${state.ok === false ? "text-danger" : "text-success"}`}>
        {state.message ?? ""}
      </p>
    </form>
  );
}

/** Keuzelijst die het omliggende formulier direct verstuurt bij een wijziging (zonder JavaScript: de knop ernaast). */
export function AutoSubmitSelect({ name, id, defaultValue, options, className = "field" }: { name: string; id?: string; defaultValue: string; options: { value: string; label: string }[]; className?: string }) {
  const ref = useRef<HTMLSelectElement>(null);
  // key: na het versturen zet React het formulier terug op de eerste defaultValue; opnieuw opbouwen toont de nieuwe keuze
  return (
    <select key={defaultValue} ref={ref} id={id} name={name} defaultValue={defaultValue} className={className} onChange={() => ref.current?.form?.requestSubmit()}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
