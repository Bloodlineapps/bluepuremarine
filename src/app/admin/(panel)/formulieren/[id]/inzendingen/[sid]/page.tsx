import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, PageHeader, Panel, btnSm, fmtDateTime } from "@/components/admin/ui";
import { can, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseSteps } from "@/lib/forms";
import { parse } from "@/lib/json";

export const metadata = { title: "Inzending" };

export default async function Submission({ params }: { params: Promise<{ id: string; sid: string }> }) {
  const user = await requireUser();
  const { id, sid } = await params;
  const [form, sub] = await Promise.all([db.form.findUnique({ where: { id } }), db.formSubmission.findUnique({ where: { id: sid } })]);
  if (!form || !sub || sub.formId !== id) notFound();
  if (!sub.read && can(user, "user")) await db.formSubmission.update({ where: { id: sid }, data: { read: true } });
  const data = parse<Record<string, string | string[]>>(sub.data, {});
  const files = parse<{ field: string; name: string; path: string; size: number }[]>(sub.files, []);
  const steps = parseSteps(form.steps);
  return (
    <>
      <PageHeader
        title={`Inzending van ${fmtDateTime(sub.createdAt)}`}
        description={form.name}
        action={
          <Link href={`/admin/formulieren/${id}/inzendingen/`} className={btnSm}>
            ← Alle inzendingen
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Panel>
          {steps.map((s) => (
            <div key={s.id} className="mb-6 last:mb-0">
              {steps.length > 1 && <h2 className="mb-2 font-sans text-sm font-semibold uppercase tracking-wider text-ink-soft">{s.title}</h2>}
              <dl className="divide-y divide-line">
                {s.fields.map((f) => (
                  <div key={f.id} className="grid gap-1 py-3 sm:grid-cols-[200px_1fr]">
                    <dt className="text-sm text-ink-soft">{f.label}</dt>
                    <dd className="whitespace-pre-wrap">
                      {f.type === "file"
                        ? files
                            .filter((x) => x.field === f.id)
                            .map((x) => (
                              <a key={x.path} href={`/admin/bestand/${x.path}`} className="underline">
                                {x.name} ({Math.round(x.size / 1024)} kB)
                              </a>
                            ))
                        : Array.isArray(data[f.id])
                          ? (data[f.id] as string[]).join(", ")
                          : (data[f.id] as string) || "–"}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </Panel>
        <Panel title="Details">
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-ink-soft">Ingevuld op pagina</dt>
              <dd className="font-mono">{sub.sourcePath ?? "–"}</dd>
            </div>
            <div>
              <dt className="text-ink-soft">E-mailmelding</dt>
              <dd>
                <Badge tone={sub.mailStatus === "verstuurd" ? "success" : sub.mailStatus === "mislukt" ? "danger" : "neutral"}>{sub.mailStatus}</Badge>
              </dd>
            </div>
            {sub.webhookStatus && (
              <div>
                <dt className="text-ink-soft">Webhook</dt>
                <dd>{sub.webhookStatus}</dd>
              </div>
            )}
          </dl>
        </Panel>
      </div>
    </>
  );
}
