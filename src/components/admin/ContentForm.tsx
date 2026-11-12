"use client";
import { useState } from "react";
import type { ActionResult } from "./fields";
import { AdminForm, ImageField, ImageListEditor, RichText, SeoFields } from "./fields";
import { Field, Panel, input } from "./ui";

// Eén formulier voor pagina's, blogs, reviews en categorieën; per type worden velden aan- of uitgezet.
export type ContentData = {
  title: string;
  titleName?: "title" | "name";
  path?: string;
  slug?: string;
  html: string;
  /** korte inleiding onder de H1 */
  intro?: string | null;
  textareas?: { name: string; label: string; value: string | null; hint?: string; rows?: number }[];
  multi?: { name: string; label: string; options: string[]; values: string[] } | null;
  htmlName?: string;
  htmlLabel?: string;
  extraHtml?: { name: string; label: string; value: string } | null;
  image?: string | null;
  imageName?: string;
  imageAlt?: string | null;
  imageAltName?: string;
  gallery?: { src: string; alt: string }[] | null;
  faqs?: { q: string; a: string }[] | null;
  excerpt?: string | null;
  status: string;
  publishedAt?: string | null;
  noindex?: boolean | null;
  select?: { name: string; label: string; value: string | null; options: { value: string; label: string }[] }[];
  text?: { name: string; label: string; value: string | null; hint?: string }[];
  checkboxes?: { name: string; label: string; checked: boolean }[];
  metaTitle?: string | null;
  metaDescription?: string | null;
  /** deel-afbeelding (og:image); undefined = veld niet tonen */
  ogImage?: string | null;
  pathLocked?: boolean;
  statusLocked?: boolean;
};

export function ContentForm({ data, action, aiAction, aiEnabled, readOnly, pathHint }: { data: ContentData; action: (s: ActionResult, f: FormData) => Promise<ActionResult>; aiAction?: (f: FormData) => Promise<{ text?: string; error?: string }>; aiEnabled?: boolean; readOnly: boolean; pathHint?: string }) {
  const [faqs, setFaqs] = useState(data.faqs ?? []);
  return (
    <AdminForm
      action={action}
      readOnly={readOnly}
      aside={
        <Panel title="Publicatie">
          <div className="space-y-3">
            {!data.statusLocked && (
              <Field label="Status">
                <select name="status" defaultValue={data.status} className={input}>
                  <option value="published">Gepubliceerd</option>
                  <option value="draft">Concept</option>
                </select>
              </Field>
            )}
            {data.publishedAt !== undefined && (
              <Field label="Publicatiedatum">
                <input type="datetime-local" name="publishedAt" defaultValue={data.publishedAt ?? ""} className={input} />
              </Field>
            )}
            {data.select?.map((s) => (
              <Field key={s.name} label={s.label}>
                <select name={s.name} defaultValue={s.value ?? ""} className={input}>
                  {s.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
            {data.noindex !== undefined && data.noindex !== null && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="noindex" defaultChecked={data.noindex} /> Niet indexeren (noindex)
              </label>
            )}
            {data.checkboxes?.map((c) => (
              <label key={c.name} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name={c.name} defaultChecked={c.checked} /> {c.label}
              </label>
            ))}
          </div>
        </Panel>
      }
    >
      <Panel title="Inhoud">
        <div className="space-y-4">
          <Field label="Titel (H1)">
            <input name={data.titleName ?? "title"} defaultValue={data.title} required className={input} />
          </Field>
          {data.path !== undefined && (
            <Field label="URL-pad" hint={pathHint ?? "(kleine letters, koppeltekens, slash aan het eind; wijzigen maakt een 301-redirect)"}>
              <input name="path" defaultValue={data.path} readOnly={data.pathLocked} className={`${input} font-mono`} />
            </Field>
          )}
          {data.slug !== undefined && (
            <Field label="Slug" hint="(laatste deel van de URL)">
              <input name="slug" defaultValue={data.slug} className={`${input} font-mono`} />
            </Field>
          )}
          {data.text?.map((t) => (
            <Field key={t.name} label={t.label} hint={t.hint}>
              <input name={t.name} defaultValue={t.value ?? ""} className={input} />
            </Field>
          ))}
          {data.excerpt !== undefined && (
            <Field label="Samenvatting" hint="(voor overzichten; leeg = eerste alinea)">
              <textarea name="excerpt" defaultValue={data.excerpt ?? ""} rows={2} className={input} />
            </Field>
          )}
          {data.textareas?.map((t) => (
            <Field key={t.name} label={t.label} hint={t.hint}>
              <textarea name={t.name} defaultValue={t.value ?? ""} rows={t.rows ?? 3} className={input} />
            </Field>
          ))}
          {data.multi && (
            <fieldset>
              <legend className="mb-1.5 block text-xs font-medium text-ink-soft">{data.multi.label}</legend>
              <div className="flex flex-wrap gap-2">
                {data.multi.options.map((o) => (
                  <label key={o} className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm has-[:checked]:border-lilac-700 has-[:checked]:bg-lilac">
                    <input type="checkbox" name={data.multi!.name} value={o} defaultChecked={data.multi!.values.includes(o)} /> {o}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {data.intro !== undefined && (
            <div>
              <span className="mb-1.5 block text-xs font-medium text-ink-soft">Inleiding (onder de titel)</span>
              <RichText name="intro" value={data.intro ?? ""} minHeight={110} />
            </div>
          )}
          <div>
            <span className="mb-1.5 block text-xs font-medium text-ink-soft">{data.htmlLabel ?? "Tekst"}</span>
            <RichText name={data.htmlName ?? "html"} value={data.html} />
          </div>
          {data.extraHtml && (
            <div>
              <span className="mb-1.5 block text-xs font-medium text-ink-soft">{data.extraHtml.label}</span>
              <RichText name={data.extraHtml.name} value={data.extraHtml.value} minHeight={200} />
            </div>
          )}
        </div>
      </Panel>

      {data.imageName && (
        <Panel title="Afbeelding">
          <ImageField name={data.imageName} altName={data.imageAltName} value={data.image} alt={data.imageAlt} />
        </Panel>
      )}

      {data.gallery && (
        <Panel title="Fotogalerij">
          <ImageListEditor name="gallery" value={data.gallery} />
        </Panel>
      )}

      {data.faqs && (
        <Panel title="Veelgestelde vragen (FAQPage)">
          <input type="hidden" name="faqs" value={JSON.stringify(faqs)} />
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <div key={i} className="rounded-xl border border-line p-3">
                <input value={f.q} onChange={(e) => setFaqs(faqs.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} placeholder="Vraag" className={`${input} font-medium`} aria-label={`Vraag ${i + 1}`} />
                <textarea value={f.a} onChange={(e) => setFaqs(faqs.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} placeholder="Antwoord" rows={2} className={`${input} mt-2`} aria-label={`Antwoord ${i + 1}`} />
                <button type="button" onClick={() => setFaqs(faqs.filter((_, j) => j !== i))} className="mt-2 text-xs text-danger underline">
                  Vraag verwijderen
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setFaqs([...faqs, { q: "", a: "" }])} className="rounded-full border border-line px-3 py-1.5 text-xs hover:border-ink">
              + Vraag toevoegen
            </button>
          </div>
        </Panel>
      )}

      <Panel title="Zoekmachines (SEO)">
        <SeoFields metaTitle={data.metaTitle} metaDescription={data.metaDescription} aiAction={aiAction} aiEnabled={aiEnabled} ogImage={data.ogImage} showOg={data.ogImage !== undefined} path={data.path} />
      </Panel>
    </AdminForm>
  );
}
