"use client";
import { useState } from "react";
import type { Discount } from "@prisma/client";
import { saveDiscount } from "@/app/admin/actions/shop";
import { AdminForm } from "@/components/admin/fields";
import { DISCOUNT_TYPES, euros } from "@/components/admin/shop/format";
import { Field, Panel, input } from "@/components/admin/ui";

const local = (d: Date | null | undefined) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

/** Kortingscode: percentage, vast bedrag of gratis verzending, met optionele voorwaarden en looptijd. */
export function DiscountForm({ discount: d }: { discount: Discount | null }) {
  const [type, setType] = useState(d?.type ?? "percent");
  const [code, setCode] = useState(d?.code ?? "");
  return (
    <AdminForm
      action={saveDiscount.bind(null, d?.id ?? null)}
      aside={
        <Panel title="Status">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={d?.active ?? true} /> Actief (te gebruiken in de winkelwagen)
          </label>
          {d && (
            <p className="mt-3 text-sm text-ink-soft">
              {d.used} keer gebruikt{d.usageLimit ? ` van de ${d.usageLimit}` : ""}.
            </p>
          )}
        </Panel>
      }
    >
      <Panel title="Kortingscode">
        <div className="space-y-4">
          <Field label="Code" hint="(wat de klant intypt; hoofdletters, cijfers en koppeltekens)">
            <input name="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, ""))} required placeholder="ZOMER10" className={`${input} font-mono uppercase`} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Soort korting">
              <select name="type" value={type} onChange={(e) => setType(e.target.value)} className={input}>
                {Object.entries(DISCOUNT_TYPES).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            {type === "percent" && (
              <Field label="Percentage" hint="(1 tot 100)">
                <input name="value" type="number" min={1} max={100} defaultValue={d?.type === "percent" ? d.value : ""} required className={input} />
              </Field>
            )}
            {type === "fixed" && (
              <Field label="Bedrag in euro's" hint="(incl. btw)">
                <input name="value" inputMode="decimal" defaultValue={d?.type === "fixed" ? euros(d.value) : ""} required placeholder="5,00" className={input} />
              </Field>
            )}
            {type === "shipping" && <p className="self-end pb-2 text-sm text-ink-soft">De verzendkosten vervallen voor de klant.</p>}
          </div>
        </div>
      </Panel>
      <Panel title="Voorwaarden">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Minimaal orderbedrag in euro's" hint="(leeg = geen minimum)">
            <input name="minOrder" inputMode="decimal" defaultValue={d?.minOrder ? euros(d.minOrder) : ""} className={input} />
          </Field>
          <Field label="Limiet" hint="(hoe vaak de code in totaal gebruikt mag worden; leeg = onbeperkt)">
            <input name="usageLimit" type="number" min={1} defaultValue={d?.usageLimit ?? ""} className={input} />
          </Field>
          <Field label="Geldig vanaf" hint="(leeg = direct)">
            <input name="startsAt" type="datetime-local" defaultValue={local(d?.startsAt)} className={input} />
          </Field>
          <Field label="Geldig tot" hint="(leeg = geen einddatum)">
            <input name="endsAt" type="datetime-local" defaultValue={local(d?.endsAt)} className={input} />
          </Field>
        </div>
      </Panel>
    </AdminForm>
  );
}
