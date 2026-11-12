"use client";
import { useState } from "react";
import type { Brand } from "@prisma/client";
import { saveBrand, suggestShopMeta } from "@/app/admin/actions/shop";
import { AdminForm, ImageField, SeoFields } from "@/components/admin/fields";
import { Field, Panel, input } from "@/components/admin/ui";

/** Merkformulier: naam, logo, omschrijving en SEO. De merkpagina staat op /merken/<slug>/. */
export function BrandForm({ brand: b, aiEnabled }: { brand: Brand | null; aiEnabled: boolean }) {
  const [slug, setSlug] = useState(b?.slug ?? "");
  return (
    <AdminForm
      action={saveBrand.bind(null, b?.id ?? null)}
      aside={
        <Panel title="Volgorde">
          <Field label="Positie" hint="(laag = eerst op de merkenpagina; leeg = achteraan)">
            <input type="number" name="sortOrder" defaultValue={b?.sortOrder ?? ""} className={input} />
          </Field>
          <p className="mt-2 text-xs text-ink-soft">Je kunt de volgorde ook slepen in het merkenoverzicht.</p>
        </Panel>
      }
    >
      <Panel title="Merk">
        <div className="space-y-4">
          <Field label="Naam">
            <input name="name" defaultValue={b?.name ?? ""} required className={input} />
          </Field>
          <Field label="Slug" hint={`(de URL wordt /merken/${slug || "…"}/ — leeg = automatisch uit de naam; wijzigen maakt automatisch een 301-redirect)`}>
            <input name="slug" value={slug} onChange={(e) => setSlug(e.target.value)} className={`${input} font-mono`} />
          </Field>
          <input type="hidden" name="path" value={`/merken/${slug || "…"}/`} />
          <Field label="Omschrijving" hint="(korte tekst boven de producten op de merkpagina)">
            <textarea name="description" defaultValue={b?.description ?? ""} rows={5} className={input} />
          </Field>
          <ImageField name="logo" value={b?.logo} label="Logo (bij voorkeur SVG of PNG met transparante achtergrond)" />
        </div>
      </Panel>
      <Panel title="Zoekmachines (SEO)">
        <SeoFields metaTitle={b?.metaTitle} metaDescription={b?.metaDescription} aiAction={suggestShopMeta} aiEnabled={aiEnabled} path={b ? `/merken/${b.slug}/` : undefined} />
      </Panel>
    </AdminForm>
  );
}
