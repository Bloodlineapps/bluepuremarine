"use client";
import type { Faq } from "@prisma/client";
import { saveFaq } from "@/app/admin/actions/content";
import { AdminForm, RichText } from "@/components/admin/fields";
import { Field, Panel, input } from "@/components/admin/ui";

export function FaqForm({ faq, categories = [] }: { faq: Faq | null; categories?: string[] }) {
  return (
    <AdminForm
      action={saveFaq.bind(null, faq?.id ?? null)}
      aside={
        <Panel title="Publicatie">
          <div className="space-y-3">
            <Field label="Status">
              <select name="status" defaultValue={faq?.status ?? "published"} className={input}>
                <option value="published">Gepubliceerd</option>
                <option value="draft">Concept</option>
              </select>
            </Field>
            <Field label="Categorie" hint="(kopje op de pagina)">
              <input name="category" defaultValue={faq?.category ?? "Algemeen"} list="faq-categories" className={input} />
              <datalist id="faq-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            {faq && (
              <Field label="Volgorde">
                <input type="number" name="sortOrder" defaultValue={faq.sortOrder} className={input} />
              </Field>
            )}
          </div>
        </Panel>
      }
    >
      <Panel title="Vraag en antwoord">
        <div className="space-y-4">
          <Field label="Vraag">
            <input name="question" defaultValue={faq?.question ?? ""} required className={input} />
          </Field>
          <div>
            <span className="mb-1.5 block text-xs font-medium text-ink-soft">Antwoord (link waar mogelijk naar een product, categorie of de klantenservice)</span>
            <RichText name="answer" value={faq?.answer ?? ""} minHeight={160} />
          </div>
        </div>
      </Panel>
    </AdminForm>
  );
}
