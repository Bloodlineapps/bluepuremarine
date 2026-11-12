"use client";
import { useActionState } from "react";
import { subscribeNewsletter, type SimpleState } from "@/app/actions/public";
import { Icon } from "@/components/Icon";
import { dict } from "@/lib/i18n";

/** Nieuwsbriefinschrijving in de footer: e-mailveld + knop, honeypot tegen spam, bevestiging van de server. */
export function NewsletterForm() {
  const t = dict("nl");
  const [state, action, pending] = useActionState<SimpleState, FormData>(subscribeNewsletter, { ok: false });

  if (state.ok && state.message)
    return (
      <p role="status" className="mt-4 flex items-start gap-2 rounded-lg bg-success-100 px-4 py-3 font-semibold text-success">
        <Icon name="check" className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2.6} />
        {state.message}
      </p>
    );

  return (
    <form action={action} className="mt-4">
      <label htmlFor="newsletter-email" className="sr-only">
        {t.footer.newsletterLabel}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input id="newsletter-email" type="email" name="email" required maxLength={200} autoComplete="email" placeholder="naam@voorbeeld.nl" defaultValue={state.values?.email} aria-invalid={state.message ? true : undefined} aria-describedby={state.message ? "newsletter-error" : undefined} className="field sm:flex-1" />
        <button type="submit" disabled={pending} className="btn-primary shrink-0">
          {pending ? t.form.sending : t.footer.newsletterButton}
        </button>
      </div>
      {/* honeypot: onzichtbaar voor mensen, ingevuld door bots */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          {t.form.honeypot}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <p id="newsletter-error" role="alert" className="mt-2 min-h-[1lh] text-[0.9rem] font-medium text-danger">
        {state.message ?? ""}
      </p>
    </form>
  );
}
