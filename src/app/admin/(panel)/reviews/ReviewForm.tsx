"use client";
import type { Review } from "@prisma/client";
import { saveReview } from "@/app/admin/actions/shop";
import { AdminForm } from "@/components/admin/fields";
import { REVIEW_STATUS, stars } from "@/components/admin/shop/format";
import { Field, Panel, input } from "@/components/admin/ui";

/** Review handmatig toevoegen of bewerken. Alleen goedgekeurde reviews staan op de site en tellen mee in het cijfer. */
export function ReviewForm({ review: r, products }: { review: Review | null; products: { id: string; name: string }[] }) {
  const day = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return (
    <AdminForm
      action={saveReview.bind(null, r?.id ?? null)}
      aside={
        <Panel title="Beoordeling">
          <div className="space-y-3">
            <Field label="Status">
              <select name="status" defaultValue={r?.status ?? "approved"} className={input}>
                {Object.entries(REVIEW_STATUS).map(([v, s]) => (
                  <option key={v} value={v}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="verified" defaultChecked={r?.verified ?? false} /> Geverifieerde koper
            </label>
            {r && <p className="text-xs text-ink-soft">Bron: {r.source === "import" ? "overgenomen van de oude site" : r.source === "beheer" ? "toegevoegd in het beheer" : "formulier op de site"}</p>}
          </div>
        </Panel>
      }
    >
      <Panel title="Review">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Naam">
              <input name="name" defaultValue={r?.name ?? ""} required className={input} />
            </Field>
            <Field label="E-mailadres" hint="(optioneel; wordt niet getoond op de site)">
              <input name="email" type="email" defaultValue={r?.email ?? ""} className={input} />
            </Field>
            <Field label="Score">
              <select name="rating" defaultValue={r?.rating ?? 5} className={input}>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {stars(n)} ({n})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Datum">
              <input name="date" type="date" defaultValue={day(r?.date ?? new Date())} className={input} />
            </Field>
          </div>
          <Field label="Product" hint="(leeg = review over de winkel als geheel)">
            <select name="productId" defaultValue={r?.productId ?? ""} className={input}>
              <option value="">Geen product (winkelreview)</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Titel" hint="(optioneel)">
            <input name="title" defaultValue={r?.title ?? ""} className={input} />
          </Field>
          <Field label="Tekst">
            <textarea name="text" defaultValue={r?.text ?? ""} rows={6} required className={input} />
          </Field>
        </div>
      </Panel>
    </AdminForm>
  );
}
