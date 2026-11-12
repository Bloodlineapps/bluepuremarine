import { saveSiteSettings } from "@/app/admin/actions/manage";
import { SimpleForm } from "@/components/admin/SimpleForm";
import { Field, Panel, input } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";
import { getSite } from "@/lib/settings";

export const metadata = { title: "Instellingen: Bedrijf" };

const SOCIALS = [
  ["facebook", "Facebook"],
  ["instagram", "Instagram"],
  ["x", "X (Twitter)"],
  ["linkedin", "LinkedIn"],
  ["youtube", "YouTube"],
] as const;

export default async function CompanySettings() {
  await requireUser();
  const site = await getSite();
  return (
    <SimpleForm action={saveSiteSettings}>
      <Panel title="Bedrijf">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Naam">
            <input name="name" defaultValue={site.name} required className={input} />
          </Field>
          <Field label="Juridische naam">
            <input name="legalName" defaultValue={site.legalName} className={input} />
          </Field>
          <Field label="KvK-nummer">
            <input name="kvk" defaultValue={site.kvk} inputMode="numeric" className={input} />
          </Field>
          <Field label="Btw-nummer">
            <input name="vat" defaultValue={site.vat} className={input} />
          </Field>
          <Field label="Korte omschrijving" hint="(footer en structured data)" className="sm:col-span-2">
            <input name="tagline" defaultValue={site.tagline} className={input} />
          </Field>
        </div>
      </Panel>

      <Panel title="Adres">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Straat en huisnummer" className="lg:col-span-2">
            <input name="street" defaultValue={site.street} className={input} />
          </Field>
          <Field label="Postcode">
            <input name="postalCode" defaultValue={site.postalCode} className={input} />
          </Field>
          <Field label="Plaats">
            <input name="city" defaultValue={site.city} className={input} />
          </Field>
          <Field label="Landcode" hint="(twee letters, bv. NL)">
            <input name="country" defaultValue={site.country} maxLength={2} className={`${input} font-mono uppercase`} />
          </Field>
        </div>
      </Panel>

      <Panel title="Contact en klantenservice">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="E-mailadres">
            <input name="email" type="email" defaultValue={site.email} required className={input} />
          </Field>
          <Field label="Telefoon" hint="(zoals getoond)">
            <input name="phone" defaultValue={site.phone} className={input} />
          </Field>
          <Field label="Telefoon internationaal" hint="(voor de bel-link, bv. +31612345678)">
            <input name="phoneIntl" defaultValue={site.phoneIntl} className={`${input} font-mono`} />
          </Field>
          <Field label="WhatsApp-nummer" hint="(internationaal zonder +; leeg = geen WhatsApp-knop)">
            <input name="whatsapp" defaultValue={site.whatsapp} inputMode="numeric" className={`${input} font-mono`} />
          </Field>
          <Field label="Eerste WhatsApp-bericht" hint="(wordt klaargezet voor de klant)" className="sm:col-span-2">
            <input name="whatsappText" defaultValue={site.whatsappText} className={input} />
          </Field>
          <Field label="Bereikbaarheid klantenservice" hint="(bv. 09:00 tot 17:00; leeg = niet tonen)">
            <input name="serviceHours" defaultValue={site.serviceHours} className={input} />
          </Field>
        </div>
      </Panel>

      <Panel title="Social media">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SOCIALS.map(([key, label]) => (
            <Field key={key} label={label} hint="(volledige URL met https://; leeg = niet tonen)">
              <input name={key} type="url" defaultValue={site.socials[key]} placeholder="https://…" className={input} />
            </Field>
          ))}
        </div>
      </Panel>
    </SimpleForm>
  );
}
