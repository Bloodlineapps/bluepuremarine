"use client";
import { useState } from "react";
import type { Category } from "@prisma/client";
import { saveCategory, suggestShopMeta } from "@/app/admin/actions/shop";
import { AdminForm, ImageField, RichText, SeoFields } from "@/components/admin/fields";
import { Field, Panel, input } from "@/components/admin/ui";

/** Categorieformulier. De URL volgt uit de slug en de bovenliggende categorie: /<slug>/ of /<ouder>/<slug>/ (maximaal twee niveaus). */
export function CategoryForm({ category: c, parents, groups, hasChildren, aiEnabled, defaultParent }: { category: Category | null; parents: { id: string; name: string; path: string }[]; groups: string[]; hasChildren: boolean; aiEnabled: boolean; defaultParent?: string }) {
  const [slug, setSlug] = useState(c?.slug ?? "");
  const [parentId, setParentId] = useState(c ? (c.parentId ?? "") : (defaultParent ?? ""));
  const parent = parents.find((p) => p.id === parentId);
  const path = `${parent?.path ?? "/"}${slug || "…"}/`;
  return (
    <AdminForm
      action={saveCategory.bind(null, c?.id ?? null)}
      aside={
        <>
          <Panel title="Publicatie">
            <div className="space-y-3">
              <Field label="Status">
                <select name="status" defaultValue={c?.status ?? "published"} className={input}>
                  <option value="published">Gepubliceerd</option>
                  <option value="draft">Concept (niet zichtbaar)</option>
                </select>
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="noindex" defaultChecked={c?.noindex ?? false} /> Niet indexeren (noindex)
              </label>
            </div>
          </Panel>
          <Panel title="Plek in het menu">
            <div className="space-y-3">
              <Field label="Bovenliggende categorie" hint={hasChildren ? "(vast: deze categorie heeft zelf subcategorieën)" : "(leeg = hoofdcategorie; maximaal twee niveaus)"}>
                <select name="parentId" value={parentId} onChange={(e) => setParentId(e.target.value)} className={input}>
                  <option value="">Geen (hoofdcategorie)</option>
                  {!hasChildren &&
                    parents.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </Field>
              {parentId && (
                <>
                  <Field label="Menugroep" hint="(kopje van de kolom in het megamenu, bv. Aan dek)">
                    <input name="menuGroup" defaultValue={c?.menuGroup ?? ""} list="menu-groups" className={input} />
                  </Field>
                  <datalist id="menu-groups">
                    {groups.map((g) => (
                      <option key={g} value={g} />
                    ))}
                  </datalist>
                </>
              )}
              <Field label="Naam in het menu" hint="(leeg = de naam)">
                <input name="navTitle" defaultValue={c?.navTitle ?? ""} className={input} />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="highlight" defaultChecked={c?.highlight ?? false} /> Accentkleur in het menu (voor acties en deals)
              </label>
            </div>
          </Panel>
        </>
      }
    >
      <Panel title="Categorie">
        <div className="space-y-4">
          <Field label="Naam (H1)">
            <input name="name" defaultValue={c?.name ?? ""} required className={input} />
          </Field>
          <Field label="Slug" hint={`(de URL wordt ${path} — leeg = automatisch uit de naam; wijzigen maakt automatisch een 301-redirect${hasChildren ? ", ook voor de subcategorieën" : ""})`}>
            <input name="slug" value={slug} onChange={(e) => setSlug(e.target.value)} className={`${input} font-mono`} />
          </Field>
          <input type="hidden" name="path" value={path} />
          <Field label="Inleiding" hint="(korte tekst boven de producten)">
            <textarea name="intro" defaultValue={c?.intro ?? ""} rows={3} className={input} />
          </Field>
          <div>
            <span className="mb-1.5 block text-xs font-medium text-ink-soft">Omschrijving (SEO-tekst onder de producten)</span>
            <RichText name="description" value={c?.description ?? ""} minHeight={220} />
          </div>
        </div>
      </Panel>
      <Panel title="Afbeelding">
        <ImageField name="image" altName="imageAlt" value={c?.image} alt={c?.imageAlt} label="Afbeelding van de categorie (kaarten op de homepage en in het menu; alt-tekst verplicht)" />
      </Panel>
      <Panel title="Zoekmachines (SEO)">
        <SeoFields metaTitle={c?.metaTitle} metaDescription={c?.metaDescription} aiAction={suggestShopMeta} aiEnabled={aiEnabled} path={c?.path} />
      </Panel>
    </AdminForm>
  );
}
