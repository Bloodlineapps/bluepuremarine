"use client";
import { useState } from "react";
import type { Product, Variant } from "@prisma/client";
import { saveProduct, suggestShopMeta } from "@/app/admin/actions/shop";
import { AdminForm, ImageListEditor, RichText, SeoFields } from "@/components/admin/fields";
import { SpecsEditor } from "@/components/admin/shop/SpecsEditor";
import { VariantsEditor } from "@/components/admin/shop/VariantsEditor";
import { VAT_RATES, euros } from "@/components/admin/shop/format";
import { Field, Panel, input } from "@/components/admin/ui";

type Opt = { id: string; name: string };
export type CategoryOption = Opt & { children: Opt[] };
type ProductWith = Product & { variants: Variant[]; categories: { categoryId: string }[] };

const list = <T,>(json: string | undefined, fallback: T[]): T[] => {
  try {
    const v = JSON.parse(json || "[]") as unknown;
    return Array.isArray(v) ? (v as T[]) : fallback;
  } catch {
    return fallback;
  }
};
const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

/** Productformulier: inhoud, afbeeldingen, prijs en voorraad, varianten, specificaties en SEO; publicatie en indeling in de zijkolom. */
export function ProductForm({ product: p, brands, categories, types, aiEnabled }: { product: ProductWith | null; brands: Opt[]; categories: CategoryOption[]; types: string[]; aiEnabled: boolean }) {
  const [slug, setSlug] = useState(p?.slug ?? "");
  const checked = new Set(p?.categories.map((c) => c.categoryId) ?? []);
  const hasVariants = (p?.variants.length ?? 0) > 0;
  return (
    <AdminForm
      action={saveProduct.bind(null, p?.id ?? null)}
      aside={
        <>
          <Panel title="Publicatie">
            <div className="space-y-3">
              <Field label="Status">
                <select name="status" defaultValue={p?.status ?? "draft"} className={input}>
                  <option value="published">Gepubliceerd</option>
                  <option value="draft">Concept (niet zichtbaar)</option>
                </select>
              </Field>
              <Field label="Publicatiedatum" hint="(bepaalt de sortering op nieuwste)">
                <input type="datetime-local" name="publishedAt" defaultValue={p ? local(p.publishedAt) : ""} className={input} />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="featured" defaultChecked={p?.featured ?? false} /> Uitgelicht (homepage en bovenaan in overzichten)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="noindex" defaultChecked={p?.noindex ?? false} /> Niet indexeren (noindex)
              </label>
            </div>
          </Panel>
          <Panel title="Indeling">
            <div className="space-y-3">
              <Field label="Merk">
                <select name="brandId" defaultValue={p?.brandId ?? ""} className={input}>
                  <option value="">Geen merk</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Productsoort" hint="(filter in de winkel, bv. Reiniger)">
                <input name="productType" defaultValue={p?.productType ?? ""} list="product-types" className={input} />
              </Field>
              <datalist id="product-types">
                {types.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              <Field label="Hoofdcategorie" hint="(kruimelpad en gerelateerde producten)">
                <select name="primaryCategoryId" defaultValue={p?.primaryCategoryId ?? ""} className={input}>
                  <option value="">Geen</option>
                  {categories.map((c) => (
                    <optgroup key={c.id} label={c.name}>
                      <option value={c.id}>{c.name}</option>
                      {c.children.map((s) => (
                        <option key={s.id} value={s.id}>
                          {c.name} › {s.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Field>
              <fieldset>
                <legend className="mb-1.5 block text-xs font-medium text-ink-soft">Ook tonen in</legend>
                <ul className="max-h-80 space-y-1 overflow-y-auto rounded-lg border border-line p-3 text-sm">
                  {categories.map((c) => (
                    <li key={c.id}>
                      <label className="flex items-center gap-2 font-medium">
                        <input type="checkbox" name="categoryIds" value={c.id} defaultChecked={checked.has(c.id)} /> {c.name}
                      </label>
                      {c.children.length > 0 && (
                        <ul className="ml-6 mt-1 space-y-1">
                          {c.children.map((s) => (
                            <li key={s.id}>
                              <label className="flex items-center gap-2">
                                <input type="checkbox" name="categoryIds" value={s.id} defaultChecked={checked.has(s.id)} /> {s.name}
                              </label>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-xs text-ink-soft">Een hoofdcategorie toont automatisch ook de producten uit haar subcategorieën. De hoofdcategorie hierboven wordt altijd meegenomen.</p>
              </fieldset>
            </div>
          </Panel>
        </>
      }
    >
      <Panel title="Product">
        <div className="space-y-4">
          <Field label="Naam (H1)">
            <input name="name" defaultValue={p?.name ?? ""} required className={input} />
          </Field>
          <Field label="Slug" hint={`(de URL wordt /producten/${slug || "…"}/ — leeg = automatisch uit de naam; wijzigen maakt automatisch een 301-redirect)`}>
            <input name="slug" value={slug} onChange={(e) => setSlug(e.target.value)} className={`${input} font-mono`} />
          </Field>
          <input type="hidden" name="path" value={`/producten/${slug || "…"}/`} />
          <Field label="Ondertitel" hint="(korte regel op productkaarten en onder de titel)">
            <input name="subtitle" defaultValue={p?.subtitle ?? ""} className={input} />
          </Field>
          <Field label="Inleiding" hint="(naast de afbeeldingen; twee of drie zinnen over wat het product doet)">
            <textarea name="lead" defaultValue={p?.lead ?? ""} rows={3} className={input} />
          </Field>
          <div>
            <span className="mb-1.5 block text-xs font-medium text-ink-soft">Omschrijving</span>
            <RichText name="description" value={p?.description ?? ""} />
          </div>
          <div>
            <span className="mb-1.5 block text-xs font-medium text-ink-soft">Gebruik en onderhoud (uitklapblok op de productpagina; leeg = niet tonen)</span>
            <RichText name="usage" value={p?.usage ?? ""} minHeight={160} />
          </div>
        </div>
      </Panel>

      <Panel title="Afbeeldingen">
        <p className="mb-3 text-sm text-ink-soft">De eerste afbeelding is de hoofdafbeelding (ook op productkaarten). Wijzig de volgorde met de pijltjes. Een alt-tekst per afbeelding is verplicht: beschrijf kort wat er te zien is.</p>
        <ImageListEditor name="images" value={list<{ src: string; alt: string }>(p?.images, [])} />
      </Panel>

      <Panel title="Prijs en voorraad">
        {hasVariants && <p className="mb-4 rounded-xl bg-cream px-4 py-2.5 text-sm text-ink-soft">Dit product heeft varianten: de prijs, van-prijs en voorraad hieronder worden bij het opslaan automatisch overgenomen van de varianten.</p>}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Prijs in euro's" hint="(incl. btw)">
            <input name="price" defaultValue={euros(p?.price)} inputMode="decimal" placeholder="24,95" className={input} />
          </Field>
          <Field label="Van-prijs" hint="(doorgestreept; leeg = geen)">
            <input name="compareAtPrice" defaultValue={euros(p?.compareAtPrice)} inputMode="decimal" className={input} />
          </Field>
          <Field label="Btw-tarief">
            <select name="vatRate" defaultValue={p?.vatRate ?? 21} className={input}>
              {VAT_RATES.map((r) => (
                <option key={r} value={r}>
                  {r}%
                </option>
              ))}
            </select>
          </Field>
          <Field label="SKU" hint="(artikelnummer)">
            <input name="sku" defaultValue={p?.sku ?? ""} className={input} />
          </Field>
          <Field label="EAN" hint="(barcode)">
            <input name="ean" defaultValue={p?.ean ?? ""} inputMode="numeric" className={input} />
          </Field>
          <Field label="Gewicht in gram" hint="(voor de verzending)">
            <input type="number" name="weight" min={0} defaultValue={p?.weight ?? 0} className={input} />
          </Field>
          <Field label="Voorraad">
            <input type="number" name="stock" min={0} defaultValue={p?.stock ?? 0} className={input} />
          </Field>
          <Field label="Levertijd-tekst" hint="(leeg = standaardtekst uit de instellingen)" className="sm:col-span-2">
            <input name="deliveryNote" defaultValue={p?.deliveryNote ?? ""} className={input} />
          </Field>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" name="trackStock" defaultChecked={p?.trackStock ?? true} /> Voorraad bijhouden (uit = altijd leverbaar, ook bij voorraad 0)
        </label>
      </Panel>

      <Panel title="Varianten">
        {/* na het opslaan krijgen nieuwe varianten een id: de editor laadt dan opnieuw met de opgeslagen gegevens */}
        <VariantsEditor
          key={(p?.variants ?? []).map((v) => v.id).join()}
          optionNames={list<string>(p?.optionNames, [])}
          variants={(p?.variants ?? []).map((v) => {
            const options = list<string>(v.options, []);
            // naam gelijk aan de optiewaarden = automatisch: leeg laten, dan volgt hij de waarden
            return { id: v.id, name: v.name === options.filter(Boolean).join(" / ") ? "" : v.name, options, price: euros(v.price), compareAtPrice: euros(v.compareAtPrice), sku: v.sku ?? "", stock: String(v.stock) };
          })}
        />
      </Panel>

      <Panel title="Specificaties">
        <SpecsEditor value={list<{ label: string; value: string }>(p?.specs, [])} />
      </Panel>

      <Panel title="Zoekmachines (SEO)">
        <SeoFields metaTitle={p?.metaTitle} metaDescription={p?.metaDescription} aiAction={suggestShopMeta} aiEnabled={aiEnabled} path={p?.path} />
      </Panel>
    </AdminForm>
  );
}
