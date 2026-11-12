"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { submitReview, type SimpleState } from "@/app/actions/public";
import { Icon } from "@/components/Icon";
import { dict, fmt } from "@/lib/i18n";

/**
 * Formulier "Schrijf een review" op de productpagina: naam, e-mail (optioneel), score, titel en tekst. De review
 * komt als "in afwachting" binnen en verschijnt pas na controle in het beheer. Honeypot en rate limit op de server.
 */
export function ReviewForm({ productId }: { productId: string }) {
  const t = dict("nl").review;
  const [state, action, pending] = useActionState<SimpleState, FormData>(submitReview.bind(null, productId), { ok: false });
  const [startedAt, setStartedAt] = useState(0);
  const status = useRef<HTMLParagraphElement>(null);

  useEffect(() => setStartedAt(Date.now()), []);
  useEffect(() => {
    if (state.message) status.current?.focus();
  }, [state]);

  if (state.ok && state.message)
    return (
      <p ref={status} tabIndex={-1} role="status" className="flex items-start gap-3 rounded-card bg-success-100 p-5 font-semibold text-ink outline-none">
        <Icon name="check" className="mt-0.5 h-6 w-6 shrink-0 text-success" strokeWidth={2.6} />
        {state.message}
      </p>
    );

  const e = state.errors ?? {};
  const v = state.values ?? {};
  const err = (key: string) => (
    <p id={`review-${key}-err`} className="mt-1 min-h-[1lh] text-[0.88rem] font-medium text-danger" aria-live="polite">
      {e[key] ?? ""}
    </p>
  );
  const attrs = (key: string) => ({ "aria-invalid": e[key] ? true : undefined, "aria-describedby": e[key] ? `review-${key}-err` : undefined });

  return (
    <form action={action} className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
      {state.message && !state.ok && (
        <p ref={status} tabIndex={-1} role="alert" className="rounded-lg border-l-4 border-danger bg-coral-100 px-4 py-3 text-[0.95rem] font-semibold text-danger outline-none sm:col-span-2">
          {state.message}
        </p>
      )}
      <div>
        <label htmlFor="review-name" className="label">
          {t.name}
        </label>
        <input id="review-name" name="name" required maxLength={80} autoComplete="name" defaultValue={v.name} className="field" {...attrs("name")} />
        {err("name")}
      </div>
      <div>
        <label htmlFor="review-email" className="label">
          {t.email} <span className="font-normal text-muted">(optioneel)</span>
        </label>
        <input id="review-email" name="email" type="email" maxLength={200} autoComplete="email" defaultValue={v.email} className="field" aria-invalid={e.email ? true : undefined} aria-describedby="review-email-help review-email-err" />
        <p id="review-email-help" className="mt-1 text-[0.82rem] text-muted">
          {t.emailHelp}
        </p>
        {err("email")}
      </div>
      <fieldset className="sm:col-span-2" aria-describedby={e.rating ? "review-rating-err" : undefined}>
        <legend className="label">{t.rating}</legend>
        <div className="flex flex-wrap gap-2">
          {[5, 4, 3, 2, 1].map((n) => (
            <label key={n} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-rule bg-sheet px-3 transition-colors hover:border-brand has-checked:border-brand has-checked:bg-brand-50">
              <input type="radio" name="rating" value={n} required defaultChecked={v.rating === String(n)} className="h-4 w-4 accent-brand" />
              <span className="sr-only">{fmt(t.stars, { n })}</span>
              <span aria-hidden="true" className="font-semibold text-ink">
                {n} <span className="text-sun">★</span>
              </span>
            </label>
          ))}
        </div>
        {err("rating")}
      </fieldset>
      <div className="sm:col-span-2">
        <label htmlFor="review-title" className="label">
          {t.heading} <span className="font-normal text-muted">(optioneel)</span>
        </label>
        <input id="review-title" name="title" maxLength={120} defaultValue={v.title} className="field" {...attrs("title")} />
        {err("title")}
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="review-text" className="label">
          {t.text}
        </label>
        <textarea id="review-text" name="text" required minLength={10} maxLength={3000} rows={5} defaultValue={v.text} className="field" {...attrs("text")} />
        {err("text")}
      </div>
      {/* honeypot: onzichtbaar voor mensen, ingevuld door bots */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          {dict("nl").form.honeypot}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <input type="hidden" name="_t" value={startedAt || ""} />
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? t.sending : t.send}
        </button>
      </div>
    </form>
  );
}
