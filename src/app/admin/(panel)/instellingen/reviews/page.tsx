import Link from "next/link";
import { saveReviewSettings } from "@/app/admin/actions/manage";
import { SimpleForm } from "@/components/admin/SimpleForm";
import { Field, Panel, fmtDateTime, input } from "@/components/admin/ui";
import { can, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getReviewSettings } from "@/lib/settings";

export const metadata = { title: "Instellingen: Reviews" };

export default async function ReviewSettingsPage() {
  const user = await requireUser();
  const [r, own] = await Promise.all([getReviewSettings(), db.review.aggregate({ where: { status: "approved" }, _avg: { rating: true }, _count: true })]);
  const comma = (n: number) => n.toFixed(1).replace(".", ",");
  return (
    <Panel title="Reviewscore in de header">
      <SimpleForm action={saveReviewSettings}>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="enabled" defaultChecked={r.enabled} className="h-4 w-4" /> Reviewscore tonen op de site
        </label>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Bron van het cijfer">
            <select name="source" defaultValue={r.source} className={input}>
              <option value="site">Eigen reviews (goedgekeurd in het beheer)</option>
              <option value="google">Google-reviews</option>
            </select>
          </Field>
          <Field label="Score" hint="(schaal van 5, bv. 4,8; 0 = onbekend)">
            <input name="rating" defaultValue={r.rating ? comma(r.rating) : ""} inputMode="decimal" placeholder="4,8" className={input} />
          </Field>
          <Field label="Aantal reviews">
            <input name="count" type="number" min={0} defaultValue={r.count} className={input} />
          </Field>
          <Field label="Link naar de reviews" hint="(Google-bedrijfsprofiel of reviewpagina)" className="sm:col-span-2 lg:col-span-4">
            <input name="url" type="url" defaultValue={r.url} placeholder="https://…" className={`${input} font-mono`} />
          </Field>
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
          <li>
            Bij de bron <strong className="text-ink">Eigen reviews</strong> rekent de site zelf met de goedgekeurde reviews (nu {own._count} {own._count === 1 ? "review" : "reviews"}
            {own._count ? `, gemiddeld ${comma(own._avg.rating ?? 0)}` : ""}); score en aantal hierboven worden dan niet gebruikt. Reviews beheer je bij{" "}
            <Link href="/admin/reviews/" className="underline">
              Reviews
            </Link>
            .
          </li>
          <li>
            Bij de bron <strong className="text-ink">Google-reviews</strong> worden de score en het aantal hierboven getoond. Vul alleen cijfers in die echt op Google staan.
            {can(user, "admin") ? (
              <>
                {" "}
                Automatisch ophalen kan via{" "}
                <Link href="/admin/connecties/google/" className="underline">
                  Connecties → Google → Google Reviews
                </Link>
                .
              </>
            ) : (
              " Een beheerder kan de score ook automatisch laten ophalen."
            )}
          </li>
          {r.updatedAt && <li>Score voor het laatst bijgewerkt op {fmtDateTime(new Date(r.updatedAt))}.</li>}
        </ul>
      </SimpleForm>
    </Panel>
  );
}
