import { saveHomeSettings } from "@/app/admin/actions/manage";
import { ImageField, RichText } from "@/components/admin/fields";
import { SimpleForm } from "@/components/admin/SimpleForm";
import { Field, Panel, btnSm, input } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getHome } from "@/lib/home";

export const metadata = { title: "Instellingen: Homepage" };

const BLOCKS = ["Actieblok 1: groot, links", "Actieblok 2: rechtsboven", "Actieblok 3: rechtsonder"];
const THEMES = [
  ["navy", "Marineblauw"],
  ["blue", "Blauw"],
  ["aqua", "Aqua"],
  ["coral", "Koraal"],
] as const;

export default async function HomeSettingsPage() {
  await requireUser();
  const [home, products] = await Promise.all([getHome(), db.product.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { slug: true, name: true } })]);
  return (
    <SimpleForm action={saveHomeSettings}>
      <p className="flex flex-wrap items-center gap-3 text-sm text-ink-soft">
        De drie actieblokken staan bovenaan de homepage: één groot blok links en twee kleinere rechts boven elkaar.
        <a href="/" target="_blank" className={btnSm}>
          Bekijk de homepage ↗
        </a>
      </p>
      {home.hero.map((b, i) => (
        <Panel key={i} title={BLOCKS[i]}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Klein label boven de kop">
              <input name={`hero_${i}_eyebrow`} defaultValue={b.eyebrow} className={input} />
            </Field>
            <Field label="Kleurthema">
              <select name={`hero_${i}_theme`} defaultValue={b.theme} className={input}>
                {THEMES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Titel" hint="(wordt in hoofdletters getoond; Enter = nieuwe regel)">
              <textarea name={`hero_${i}_title`} defaultValue={b.title} rows={2} required className={input} />
            </Field>
            <Field label="Tekst">
              <textarea name={`hero_${i}_text`} defaultValue={b.text} rows={2} className={input} />
            </Field>
            <Field label="Knoptekst">
              <input name={`hero_${i}_cta`} defaultValue={b.cta} className={input} />
            </Field>
            <Field label="Link" hint="(bv. /onderhoud/ of https://…)">
              <input name={`hero_${i}_href`} defaultValue={b.href} required className={`${input} font-mono`} />
            </Field>
            <Field label="Product" hint="(slug; toont de productfoto en de vanaf-prijs)">
              <input name={`hero_${i}_productSlug`} defaultValue={b.productSlug} list="home-products" className={`${input} font-mono`} autoComplete="off" />
            </Field>
            <Field label="Prijslabel" hint="(bv. Al vanaf; leeg = geen prijsblok)">
              <input name={`hero_${i}_priceLabel`} defaultValue={b.priceLabel} className={input} />
            </Field>
            <div className="sm:col-span-2">
              <ImageField name={`hero_${i}_image`} altName={`hero_${i}_imageAlt`} value={b.image} alt={b.imageAlt} label="Eigen afbeelding (leeg = de hoofdafbeelding van het product hierboven)" />
            </div>
          </div>
        </Panel>
      ))}
      <datalist id="home-products">
        {products.map((p) => (
          <option key={p.slug} value={p.slug}>
            {p.name}
          </option>
        ))}
      </datalist>

      <Panel title="Teksten">
        <div className="space-y-4">
          <Field label="Kop van de homepage (H1)" hint="(staat onder de actieblokken)">
            <input name="heading" defaultValue={home.heading} required className={input} />
          </Field>
          <Field label="Inleiding onder de kop">
            <textarea name="intro" defaultValue={home.intro} rows={2} className={input} />
          </Field>
          <Field label="Blok over BluePure Marine: titel">
            <input name="aboutTitle" defaultValue={home.aboutTitle} className={input} />
          </Field>
          <Field label="Blok over BluePure Marine: tekst">
            <textarea name="aboutText" defaultValue={home.aboutText} rows={5} className={input} />
          </Field>
          <div>
            <span className="mb-1.5 block text-xs font-medium text-ink-soft">SEO-tekst onderaan de homepage (optioneel)</span>
            <RichText name="seoText" value={home.seoText} minHeight={200} />
          </div>
        </div>
      </Panel>
    </SimpleForm>
  );
}
