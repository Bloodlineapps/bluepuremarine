"use client";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { submitForm, type FormState } from "@/app/actions/public";
import { Icon } from "@/components/Icon";
import { validateField, type FormField, type FormStep } from "@/lib/forms";
import { dict, fmt, type Locale } from "@/lib/i18n";

// Rendert een formulier uit de formulierbouwer: stappen met voortgangsbalk, Vorige/Volgende, validatie per stap
// in de browser én op de server, een honeypot tegen spam en een bevestiging pas nadat de server de inzending
// heeft opgeslagen. Zonder JavaScript werkt het ook: dan staan alle stappen onder elkaar en controleert de server.

export function FormRenderer({ formKey, steps, submitLabel, locale = "nl" }: { formKey: string; steps: FormStep[]; submitLabel: string; locale?: Locale }) {
  const t = dict(locale).form;
  const [state, action, pending] = useActionState<FormState, FormData>(submitForm.bind(null, formKey), { ok: false });
  const [step, setStep] = useState(0);
  const [js, setJs] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [startedAt, setStartedAt] = useState(0);
  const [path, setPath] = useState("");
  const ref = useRef<HTMLFormElement>(null);
  const status = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const uid = useId();

  useEffect(() => {
    setJs(true);
    setStartedAt(Date.now());
    setPath(window.location.pathname);
  }, []);
  useEffect(() => {
    if (state.redirect) router.push(state.redirect);
    if (state.errors) {
      setErrors(state.errors);
      const bad = steps.findIndex((s) => s.fields.some((f) => state.errors![f.id]));
      if (bad >= 0) setStep(bad);
    }
    if (state.ok || state.message) status.current?.focus();
  }, [state, steps, router]);

  if (state.ok && state.message)
    return (
      <div ref={status} tabIndex={-1} role="status" className="rounded-card bg-success-100 p-6 outline-none">
        <Icon name="check" className="h-8 w-8 text-success" strokeWidth={2.6} />
        <p className="mt-3 max-w-md text-[1.15rem] font-bold text-ink">{state.message}</p>
      </div>
    );

  const multi = steps.length > 1;
  const valueOf = (f: FormField) => {
    const form = ref.current;
    if (!form) return null;
    if (f.type === "checkbox") return Array.from(form.querySelectorAll<HTMLInputElement>(`input[name="${f.id}"]:checked`)).map((i) => i.value);
    if (f.type === "radio") return form.querySelector<HTMLInputElement>(`input[name="${f.id}"]:checked`)?.value ?? "";
    if (f.type === "file") {
      const file = form.querySelector<HTMLInputElement>(`input[name="${f.id}"]`)?.files?.[0];
      return file ? { name: file.name, size: file.size } : null;
    }
    return (form.elements.namedItem(f.id) as HTMLInputElement | null)?.value ?? "";
  };
  const check = (fields: FormField[]) => {
    const next: Record<string, string> = {};
    for (const f of fields) {
      const e = validateField(f, valueOf(f), locale);
      if (e) next[f.id] = e;
    }
    setErrors(next);
    if (Object.keys(next).length) {
      const first = fields.find((f) => next[f.id]);
      ref.current?.querySelector<HTMLElement>(`[name="${first!.id}"]`)?.focus();
      return false;
    }
    return true;
  };

  return (
    <form
      ref={ref}
      action={action}
      noValidate={js}
      onSubmit={(e) => {
        if (!check(steps.flatMap((s, i) => (i <= step || !multi ? s.fields : [])))) e.preventDefault();
        else if (multi && step < steps.length - 1) {
          e.preventDefault();
          setStep(step + 1);
        }
      }}
    >
      {multi && js && (
        <div className="mb-6">
          <p className="text-sm font-semibold text-ink">
            {fmt(t.step, { n: step + 1, total: steps.length })}: {steps[step].title}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper-2" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step + 1} aria-label={fmt(t.step, { n: step + 1, total: steps.length })}>
            <div className="h-full rounded-full bg-brand transition-all duration-300" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
          </div>
        </div>
      )}
      {(state.message || Object.keys(errors).length > 0) && !state.ok && (
        <div ref={status} tabIndex={-1} role="alert" className="mb-6 rounded-lg border-l-4 border-danger bg-coral-100 px-4 py-3 text-[0.95rem] font-semibold text-danger outline-none">
          {state.message ?? t.checkFields}
        </div>
      )}
      {steps.map((s, i) => (
        <fieldset key={s.id} hidden={js && multi && i !== step} className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
          <legend className={multi && !js ? "mb-3 text-xl font-bold text-ink" : "sr-only"}>{s.title}</legend>
          {s.fields.map((f) => (
            <FieldInput key={f.id} f={f} uid={uid} error={errors[f.id]} value={state.values?.[f.id]} locale={locale} />
          ))}
        </fieldset>
      ))}
      {/* honeypot: onzichtbaar voor mensen, ingevuld door bots */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          {t.honeypot}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <input type="hidden" name="_t" value={startedAt || ""} />
      <input type="hidden" name="_path" value={path} />
      <input type="hidden" name="_lang" value={locale} />
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {multi && js && step > 0 && (
          <button type="button" onClick={() => setStep(step - 1)} className="btn-secondary">
            {t.prev}
          </button>
        )}
        <button type="submit" disabled={pending} aria-disabled={pending} className="btn-primary">
          {pending ? t.sending : multi && js && step < steps.length - 1 ? t.next : submitLabel}
        </button>
      </div>
    </form>
  );
}

function FieldInput({ f, uid, error, value, locale }: { f: FormField; uid: string; error?: string; value?: string; locale: Locale }) {
  const t = dict(locale).form;
  const id = `${uid}-${f.id}`;
  const wide = f.type === "textarea" || f.type === "checkbox" || f.type === "radio" || f.type === "file";
  const describedBy = [f.help ? `${id}-help` : "", error ? `${id}-err` : ""].filter(Boolean).join(" ") || undefined;
  const common = { id, name: f.id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy, required: f.required };
  const label = f.label.replace(/\s*\((optioneel|optional)\)/i, "");
  const marker = <span className="font-normal text-muted"> ({f.required ? t.required : t.optional})</span>;
  const help = f.help && (
    <p id={`${id}-help`} className="mt-1.5 text-[0.88rem] text-muted">
      {f.help}
    </p>
  );
  const err = (
    <p id={`${id}-err`} className="mt-1 min-h-[1lh] text-[0.88rem] font-medium text-danger" aria-live="polite">
      {error ?? ""}
    </p>
  );
  let control: React.ReactNode;
  if (f.type === "textarea") control = <textarea {...common} rows={5} placeholder={f.placeholder} defaultValue={value} className="field" />;
  else if (f.type === "select")
    control = (
      <select {...common} defaultValue={value ?? ""} className="field">
        <option value="">{f.placeholder || "—"}</option>
        {f.options?.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    );
  else if (f.type === "radio" || f.type === "checkbox")
    return (
      <fieldset className="sm:col-span-2" aria-describedby={describedBy}>
        <legend className="label">
          {label}
          {marker}
        </legend>
        <div className="flex flex-col gap-2">
          {f.options?.map((o) => (
            <label key={o} className="flex min-h-10 cursor-pointer items-center gap-3">
              <input type={f.type} name={f.id} value={o} defaultChecked={value?.split("|").includes(o)} className="h-5 w-5 shrink-0 accent-brand" aria-invalid={error ? true : undefined} />
              <span>{o}</span>
            </label>
          ))}
        </div>
        {help}
        {err}
      </fieldset>
    );
  else if (f.type === "file") control = <input {...common} type="file" accept={f.accept || ".pdf,.doc,.docx,.jpg,.jpeg,.png"} className="field" />;
  else control = <input {...common} type={f.type} placeholder={f.placeholder} defaultValue={value} autoComplete={f.autocomplete} min={f.min ?? undefined} max={f.max ?? undefined} className="field" />;
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label htmlFor={id} className="label">
        {label}
        {marker}
      </label>
      {control}
      {help}
      {err}
    </div>
  );
}
