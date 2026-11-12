"use client";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { FIELD_TYPES, newId, type FieldType, type FormField, type FormStep } from "@/lib/forms";
import { AdminForm, type ActionResult } from "./fields";
import { Field, Panel, btnSm, input } from "./ui";

// Formulierbouwer: stappen en velden toevoegen, sorteren (omhoog/omlaag) en instellen. Het resultaat gaat als
// JSON in een verborgen veld naar de server, die alles opnieuw valideert.

export type FormSettingsData = {
  key: string;
  name: string;
  description: string;
  submitLabel: string;
  notifyEmails: string[];
  notifySubject: string;
  afterSubmit: string;
  successMessage: string;
  redirectPath: string | null;
  confirmEnabled: boolean;
  confirmSubject: string;
  confirmText: string;
  webhookUrl: string | null;
  status: string;
};

const move = <T,>(list: T[], i: number, d: number) => {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const copy = [...list];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
};

export function FormBuilder({ initial, settings, action, readOnly }: { initial: FormStep[]; settings: FormSettingsData; action: (s: ActionResult, f: FormData) => Promise<ActionResult>; readOnly: boolean }) {
  const [steps, setSteps] = useState<FormStep[]>(initial.length ? initial : [{ id: newId("s"), title: "Stap 1", fields: [] }]);
  const [openField, setOpenField] = useState<string | null>(null);
  const [after, setAfter] = useState(settings.afterSubmit);

  const updStep = (si: number, patch: Partial<FormStep>) => setSteps(steps.map((s, i) => (i === si ? { ...s, ...patch } : s)));
  const updField = (si: number, fi: number, patch: Partial<FormField>) => updStep(si, { fields: steps[si].fields.map((f, i) => (i === fi ? { ...f, ...patch } : f)) });
  const addField = (si: number, type: FieldType) => {
    const f: FormField = { id: newId(), type, label: FIELD_TYPES[type], required: false, ...(["select", "radio", "checkbox"].includes(type) ? { options: ["Optie 1", "Optie 2"] } : {}) };
    updStep(si, { fields: [...steps[si].fields, f] });
    setOpenField(f.id);
  };

  return (
    <AdminForm
      action={action}
      readOnly={readOnly}
      aside={
        <Panel title="Publicatie">
          <div className="space-y-3">
            <Field label="Status">
              <select name="status" defaultValue={settings.status} className={input}>
                <option value="published">Actief</option>
                <option value="draft">Concept (niet te gebruiken)</option>
              </select>
            </Field>
            <Field label="Sleutel" hint="(gebruikt door de site, bv. aanmelden)">
              <input name="key" defaultValue={settings.key} className={`${input} font-mono`} />
            </Field>
            <Field label="Tekst op de verzendknop">
              <input name="submitLabel" defaultValue={settings.submitLabel} className={input} />
            </Field>
          </div>
        </Panel>
      }
    >
      <input type="hidden" name="steps" value={JSON.stringify(steps)} />
      <Panel title="Algemeen">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Naam van het formulier">
            <input name="name" defaultValue={settings.name} required className={input} />
          </Field>
          <Field label="Omschrijving" hint="(alleen in het beheer)">
            <input name="description" defaultValue={settings.description} className={input} />
          </Field>
        </div>
      </Panel>

      <Panel
        title={`Velden en stappen (${steps.length} ${steps.length === 1 ? "stap" : "stappen"})`}
        action={
          <button type="button" className={btnSm} onClick={() => setSteps([...steps, { id: newId("s"), title: `Stap ${steps.length + 1}`, fields: [] }])}>
            + Stap toevoegen
          </button>
        }
      >
        <p className="mb-4 text-sm text-ink-soft">Bij meer dan één stap krijgt het formulier een voortgangsbalk met Vorige/Volgende; elke stap wordt apart gecontroleerd.</p>
        <div className="space-y-5">
          {steps.map((s, si) => (
            <div key={s.id} className="rounded-2xl border border-line bg-cream/50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-navy text-xs font-bold text-white">{si + 1}</span>
                <input value={s.title} onChange={(e) => updStep(si, { title: e.target.value })} className={`${input} !w-auto flex-1 font-medium`} aria-label={`Naam van stap ${si + 1}`} />
                <button type="button" className={btnSm} onClick={() => setSteps(move(steps, si, -1))} disabled={si === 0} aria-label="Stap omhoog">
                  ↑
                </button>
                <button type="button" className={btnSm} onClick={() => setSteps(move(steps, si, 1))} disabled={si === steps.length - 1} aria-label="Stap omlaag">
                  ↓
                </button>
                {steps.length > 1 && (
                  <button type="button" className={`${btnSm} !text-danger`} onClick={() => window.confirm(`Stap "${s.title}" met ${s.fields.length} velden verwijderen?`) && setSteps(steps.filter((_, i) => i !== si))}>
                    Stap verwijderen
                  </button>
                )}
              </div>
              <ul className="mt-3 space-y-2">
                {s.fields.map((f, fi) => (
                  <li key={f.id} className="rounded-xl border border-line bg-white">
                    <div className="flex flex-wrap items-center gap-2 p-2.5">
                      <button type="button" onClick={() => setOpenField(openField === f.id ? null : f.id)} className="flex flex-1 items-center gap-2 text-left text-sm" aria-expanded={openField === f.id}>
                        <Icon name="chevron" className={`h-4 w-4 transition ${openField === f.id ? "rotate-180" : ""}`} />
                        <strong>{f.label || "(zonder label)"}</strong>
                        <span className="rounded-full bg-sky px-2 text-xs text-navy">{FIELD_TYPES[f.type]}</span>
                        {f.required && <span className="text-xs text-danger">verplicht</span>}
                      </button>
                      <button type="button" className={btnSm} onClick={() => updStep(si, { fields: move(s.fields, fi, -1) })} disabled={fi === 0} aria-label="Veld omhoog">
                        ↑
                      </button>
                      <button type="button" className={btnSm} onClick={() => updStep(si, { fields: move(s.fields, fi, 1) })} disabled={fi === s.fields.length - 1} aria-label="Veld omlaag">
                        ↓
                      </button>
                      {steps.length > 1 && (
                        <select
                          aria-label="Naar andere stap"
                          className={`${input} !w-auto !py-1 text-xs`}
                          value={si}
                          onChange={(e) => {
                            const to = Number(e.target.value);
                            setSteps(steps.map((st, i) => (i === si ? { ...st, fields: st.fields.filter((_, j) => j !== fi) } : i === to ? { ...st, fields: [...st.fields, f] } : st)));
                          }}
                        >
                          {steps.map((st, i) => (
                            <option key={st.id} value={i}>
                              {i === si ? "Stap" : "→"} {i + 1}
                            </option>
                          ))}
                        </select>
                      )}
                      <button type="button" className={`${btnSm} !text-danger`} onClick={() => updStep(si, { fields: s.fields.filter((_, j) => j !== fi) })}>
                        Verwijderen
                      </button>
                    </div>
                    {openField === f.id && (
                      <div className="grid gap-3 border-t border-line p-3 sm:grid-cols-2">
                        <Field label="Label">
                          <input value={f.label} onChange={(e) => updField(si, fi, { label: e.target.value })} className={input} />
                        </Field>
                        <Field label="Type">
                          <select value={f.type} onChange={(e) => updField(si, fi, { type: e.target.value as FieldType })} className={input}>
                            {Object.entries(FIELD_TYPES).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Veldnaam (technisch)" hint="(voor export en {variabelen} in e-mails)">
                          <input value={f.id} onChange={(e) => updField(si, fi, { id: e.target.value })} className={`${input} font-mono`} />
                        </Field>
                        <Field label="Placeholder">
                          <input value={f.placeholder ?? ""} onChange={(e) => updField(si, fi, { placeholder: e.target.value })} className={input} />
                        </Field>
                        <Field label="Hulptekst" className="sm:col-span-2">
                          <input value={f.help ?? ""} onChange={(e) => updField(si, fi, { help: e.target.value })} className={input} />
                        </Field>
                        {["select", "radio", "checkbox"].includes(f.type) && (
                          <Field label="Keuzeopties" hint="(één per regel)" className="sm:col-span-2">
                            <textarea rows={4} value={(f.options ?? []).join("\n")} onChange={(e) => updField(si, fi, { options: e.target.value.split("\n") })} className={input} />
                          </Field>
                        )}
                        {(f.type === "number" || f.type === "text" || f.type === "textarea") && (
                          <>
                            <Field label={f.type === "number" ? "Minimum" : "Minimaal aantal tekens"}>
                              <input type="number" value={f.min ?? ""} onChange={(e) => updField(si, fi, { min: e.target.value === "" ? null : Number(e.target.value) })} className={input} />
                            </Field>
                            <Field label={f.type === "number" ? "Maximum" : "Maximaal aantal tekens"}>
                              <input type="number" value={f.max ?? ""} onChange={(e) => updField(si, fi, { max: e.target.value === "" ? null : Number(e.target.value) })} className={input} />
                            </Field>
                          </>
                        )}
                        {f.type !== "file" && f.type !== "checkbox" && (
                          <>
                            <Field label="Extra controle (reguliere expressie)" hint="(optioneel)">
                              <input value={f.pattern ?? ""} onChange={(e) => updField(si, fi, { pattern: e.target.value })} className={`${input} font-mono`} placeholder="bv. ^[0-9]{4} ?[A-Za-z]{2}$" />
                            </Field>
                            <Field label="Foutmelding bij extra controle">
                              <input value={f.patternMessage ?? ""} onChange={(e) => updField(si, fi, { patternMessage: e.target.value })} className={input} />
                            </Field>
                          </>
                        )}
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={!!f.required} onChange={(e) => updField(si, fi, { required: e.target.checked })} /> Verplicht veld
                        </label>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-ink-soft">Veld toevoegen:</span>
                {(Object.keys(FIELD_TYPES) as FieldType[]).map((t) => (
                  <button key={t} type="button" className={btnSm} onClick={() => addField(si, t)}>
                    + {FIELD_TYPES[t]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Na het versturen">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Wat gebeurt er?">
            <select name="afterSubmit" value={after} onChange={(e) => setAfter(e.target.value)} className={input}>
              <option value="message">Bedankmelding tonen</option>
              <option value="redirect">Doorsturen naar een pagina</option>
            </select>
          </Field>
          {after === "redirect" ? (
            <Field label="Pagina" hint="(bv. /bedankt-voor-je-reactie/)">
              <input name="redirectPath" defaultValue={settings.redirectPath ?? ""} className={`${input} font-mono`} />
            </Field>
          ) : (
            <Field label="Bedankmelding" hint="({voornaam} = voornaam van de invuller)" className="sm:col-span-2">
              <textarea name="successMessage" defaultValue={settings.successMessage} rows={2} className={input} />
            </Field>
          )}
          <Field label="Webhook (optioneel)" hint="(https; ontvangt elke inzending als JSON)" className="sm:col-span-2">
            <input name="webhookUrl" defaultValue={settings.webhookUrl ?? ""} className={`${input} font-mono`} placeholder="https://…" />
          </Field>
        </div>
      </Panel>

      <Panel title="E-mails (via SparkPost)">
        <div className="grid gap-4">
          <Field label="Melding naar" hint="(e-mailadressen, één per regel; krijgen elke inzending)">
            <textarea name="notifyEmails" defaultValue={settings.notifyEmails.join("\n")} rows={3} className={`${input} font-mono`} />
          </Field>
          <Field label="Onderwerp van de melding" hint="({formulier} en {veldnaam} worden ingevuld)">
            <input name="notifySubject" defaultValue={settings.notifySubject} className={input} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="confirmEnabled" defaultChecked={settings.confirmEnabled} /> Bevestiging sturen naar de invuller (het eerste e-mailveld)
          </label>
          <Field label="Onderwerp van de bevestiging">
            <input name="confirmSubject" defaultValue={settings.confirmSubject} className={input} />
          </Field>
          <Field label="Tekst van de bevestiging" hint="({voornaam} en andere veldnamen worden ingevuld)">
            <textarea name="confirmText" defaultValue={settings.confirmText} rows={7} className={input} />
          </Field>
        </div>
      </Panel>
    </AdminForm>
  );
}
