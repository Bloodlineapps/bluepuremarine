import { saveShopSettings } from "@/app/admin/actions/manage";
import { ShippingEditor } from "@/components/admin/SettingsFields";
import { SimpleForm } from "@/components/admin/SimpleForm";
import { Field, Panel, input } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";
import { getShop, getSite } from "@/lib/settings";

export const metadata = { title: "Instellingen: Webshop" };

/** Centen → invoerwaarde in euro's ("6,95"). */
const euros = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

export default async function ShopSettingsPage() {
  await requireUser();
  const [shop, site] = await Promise.all([getShop(), getSite()]);
  return (
    <SimpleForm action={saveShopSettings}>
      <Panel title="Verzending">
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-medium text-ink-soft">Verzendkosten per land (inclusief btw). Alleen landen in deze lijst zijn te kiezen bij het afrekenen.</p>
            <ShippingEditor name="shipping" value={shop.shipping.map((s) => ({ country: s.country, label: s.label, cost: euros(s.cost) }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Gratis verzending vanaf (€)" hint="(leeg of 0 = nooit gratis)">
              <input name="freeShippingFrom" defaultValue={shop.freeShippingFrom ? euros(shop.freeShippingFrom) : ""} inputMode="decimal" placeholder="75,00" className={input} />
            </Field>
            <Field label="Levertijdtekst" hint="(standaard op productpagina's)" className="sm:col-span-2">
              <input name="deliveryNote" defaultValue={shop.deliveryNote} className={input} />
            </Field>
            <Field label="Bedenktijd (dagen)">
              <input name="returnDays" type="number" min={0} max={365} defaultValue={shop.returnDays} className={input} />
            </Field>
          </div>
        </div>
      </Panel>

      <Panel title="Voordelen (balk bovenaan en in de footer)">
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Field key={i} label={`Voordeel ${i + 1}`}>
              <input name={`usp${i + 1}`} defaultValue={shop.usps[i] ?? ""} maxLength={60} className={input} />
            </Field>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-soft">Let op: pas het voordeel over gratis verzending aan als je de drempel hierboven wijzigt.</p>
      </Panel>

      <Panel title="Catalogus en bestellingen">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Producten per pagina" hint="(categorieën en zoekresultaten)">
            <input name="perPage" type="number" min={4} max={96} defaultValue={shop.perPage} className={input} />
          </Field>
          <Field label="Voorvoegsel bestelnummers" hint="(bv. BP-)">
            <input name="orderPrefix" defaultValue={shop.orderPrefix} maxLength={10} className={`${input} font-mono uppercase`} />
          </Field>
          <Field label="Meldadres nieuwe bestellingen" hint={`(leeg = ${site.email})`}>
            <input name="orderNotifyEmail" type="email" defaultValue={shop.orderNotifyEmail} className={input} />
          </Field>
          <Field label="IBAN voor overboekingen" hint="(alleen getoond als online betalen uit staat)" className="sm:col-span-2">
            <input name="iban" defaultValue={shop.iban} className={`${input} font-mono uppercase`} autoComplete="off" />
          </Field>
        </div>
      </Panel>
    </SimpleForm>
  );
}
