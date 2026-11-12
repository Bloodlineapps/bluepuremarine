"use client";
import type { Page } from "@prisma/client";
import { savePage, suggestMeta } from "@/app/admin/actions/content";
import { BlockEditor } from "@/components/admin/BlockEditor";
import { AdminForm, ImageField, SeoFields } from "@/components/admin/fields";
import { Field, Panel, input } from "@/components/admin/ui";
import { SECTIONS, TEMPLATES } from "@/lib/admin/labels";
import { parseBlocks } from "@/lib/blocks";

type Opt = { value: string; label: string };

/** Paginaformulier: kop, blokken-editor, SEO en publicatie. Menu's verwijzen naar de vaste sleutel van een pagina. */
export function PageForm({ page, aiEnabled, parents, forms, links }: { page: Page | null; aiEnabled: boolean; parents: Opt[]; forms: Opt[]; links: Opt[] }) {
  const isHome = page?.path === "/";
  const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return (
    <AdminForm
      action={savePage.bind(null, page?.id ?? null)}
      aside={
        <Panel title="Publicatie">
          <div className="space-y-3">
            {!isHome && (
              <Field label="Status">
                <select name="status" defaultValue={page?.status ?? "draft"} className={input}>
                  <option value="published">Gepubliceerd</option>
                  <option value="draft">Concept</option>
                </select>
              </Field>
            )}
            <Field label="Publicatiedatum">
              <input type="datetime-local" name="publishedAt" defaultValue={page ? local(page.publishedAt) : ""} className={input} />
            </Field>
            <Field label="Type pagina" hint="(bepaalt de opmaak)">
              <select name="template" defaultValue={page?.template ?? "default"} className={input}>
                {Object.entries(TEMPLATES).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
                {page && !(page.template in TEMPLATES) && <option value={page.template}>{page.template}</option>}
              </select>
            </Field>
            <Field label="Onderdeel">
              <select name="section" defaultValue={page?.section ?? "overig"} className={input}>
                {Object.entries(SECTIONS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
                {page && !(page.section in SECTIONS) && <option value={page.section}>{page.section}</option>}
              </select>
            </Field>
            <Field label="Volgorde" hint="(laag = eerst in overzichten)">
              <input type="number" name="sortOrder" defaultValue={page?.sortOrder ?? 50} className={input} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="noindex" defaultChecked={page?.noindex ?? false} /> Niet indexeren (noindex)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isDraftCopy" defaultChecked={page?.isDraftCopy ?? false} /> Concepttekst (nog controleren)
            </label>
          </div>
        </Panel>
      }
    >
      <Panel title="Kop van de pagina">
        <div className="space-y-4">
          <Field label="Titel (H1)">
            <input name="title" defaultValue={page?.title ?? ""} required className={input} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Korte titel" hint="(menu en kruimelpad; leeg = titel)">
              <input name="navTitle" defaultValue={page?.navTitle ?? ""} className={input} />
            </Field>
            <Field label="Tekst op de actieknop" hint="(optioneel)">
              <input name="ctaLabel" defaultValue={page?.ctaLabel ?? ""} className={input} />
            </Field>
          </div>
          <Field label="URL-pad" hint={isHome ? "(homepage: vast)" : "(één niveau, kleine letters en koppeltekens, slash aan het eind. Wijzigen maakt automatisch een 301-redirect)"}>
            <input name="path" defaultValue={page?.path ?? ""} readOnly={isHome} placeholder="/over-ons/" className={`${input} font-mono`} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bovenliggende pagina" hint="(alleen voor het kruimelpad)">
              <select name="parentKey" defaultValue={page?.parentKey ?? ""} className={input}>
                <option value="">Geen</option>
                {parents
                  .filter((p) => p.value !== page?.translationKey)
                  .map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Vaste sleutel" hint={page ? "(menu's verwijzen hiernaar: liever niet wijzigen)" : "(leeg = automatisch op basis van de titel)"}>
              <input name="translationKey" defaultValue={page?.translationKey ?? ""} className={`${input} font-mono`} />
            </Field>
          </div>
          <Field label="Inleiding (onder de titel)">
            <textarea name="intro" defaultValue={page?.intro ?? ""} rows={4} className={input} />
          </Field>
          <Field label="Samenvatting" hint="(korte omschrijving voor overzichten)">
            <textarea name="summary" defaultValue={page?.summary ?? ""} rows={2} className={input} />
          </Field>
          <ImageField name="heroImage" altName="heroAlt" value={page?.heroImage} alt={page?.heroAlt} label="Afbeelding bovenaan (leeg = alleen tekst)" />
        </div>
      </Panel>
      <Panel title="Blokken">
        <BlockEditor initial={parseBlocks(page?.blocks)} forms={forms} pages={links} />
      </Panel>
      <Panel title="SEO en delen">
        <SeoFields metaTitle={page?.metaTitle} metaDescription={page?.metaDescription} aiAction={suggestMeta} aiEnabled={aiEnabled} ogImage={page?.ogImage} showOg path={page?.path} />
      </Panel>
    </AdminForm>
  );
}
