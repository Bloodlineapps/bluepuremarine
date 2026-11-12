import Link from "next/link";
import { notFound } from "next/navigation";
import { bulkSubmissions } from "@/app/admin/actions/forms";
import { BulkBar } from "@/components/admin/BulkBar";
import { DataTable, PER_PAGE, readParams, type Column } from "@/components/admin/DataTable";
import { Badge, PageHeader, btnSm, fmtDateTime } from "@/components/admin/ui";
import { can, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseSteps } from "@/lib/forms";
import { parse } from "@/lib/json";
import { like } from "@/lib/search";
import type { FormSubmission } from "@prisma/client";

export const metadata = { title: "Inzendingen" };

export default async function Submissions({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const form = await db.form.findUnique({ where: { id } });
  if (!form) notFound();
  const lp = readParams(sp, { sort: "createdAt", dir: "desc" }, ["gelezen"]);
  const where = { formId: id, ...(lp.q ? { data: like(lp.q) } : {}), ...(lp.filters.gelezen ? { read: lp.filters.gelezen === "ja" } : {}) };
  const [rows, total] = await Promise.all([db.formSubmission.findMany({ where, orderBy: { createdAt: lp.dir }, skip: (lp.page - 1) * PER_PAGE, take: PER_PAGE }), db.formSubmission.count({ where })]);
  const fields = parseSteps(form.steps).flatMap((s) => s.fields).filter((f) => f.type !== "file" && f.type !== "textarea").slice(0, 4);
  const cols: Column<FormSubmission>[] = [
    {
      key: "createdAt",
      label: "Ontvangen",
      sortable: true,
      render: (r) => (
        <Link href={`/admin/formulieren/${id}/inzendingen/${r.id}/`} className={`hover:underline ${r.read ? "" : "font-semibold"}`}>
          {fmtDateTime(r.createdAt)}
        </Link>
      ),
    },
    ...fields.map((f) => ({
      key: f.id,
      label: f.label,
      render: (r: FormSubmission) => {
        const v = parse<Record<string, string | string[]>>(r.data, {})[f.id];
        return <span className="line-clamp-1">{Array.isArray(v) ? v.join(", ") : v || "–"}</span>;
      },
    })),
    { key: "files", label: "Bijlagen", render: (r) => parse<unknown[]>(r.files, []).length || "–" },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <span className="flex flex-wrap gap-1">
          {!r.read && <Badge tone="brand">nieuw</Badge>}
          <Badge tone={r.mailStatus === "verstuurd" ? "success" : r.mailStatus === "mislukt" ? "danger" : "neutral"}>mail: {r.mailStatus}</Badge>
        </span>
      ),
    },
  ];
  return (
    <>
      <PageHeader
        title={`Inzendingen: ${form.name}`}
        description={`${total} inzendingen. Zoeken doorzoekt alle ingevulde velden.`}
        action={
          <>
            <a href={`/admin/export/inzendingen/${id}/`} className={btnSm}>
              Exporteren als CSV
            </a>
            {can(user, "user") && (
              <Link href={`/admin/formulieren/${id}/bewerken/`} className={btnSm}>
                Formulier aanpassen
              </Link>
            )}
          </>
        }
      />
      {can(user, "user") && (
        <BulkBar
          formId="bulk-subs"
          action={bulkSubmissions.bind(null, id)}
          allIds={[]}
          options={[
            { value: "read", label: "Markeren als gelezen" },
            { value: "unread", label: "Markeren als ongelezen" },
            ...(can(user, "user") ? [{ value: "delete", label: "Definitief verwijderen", confirm: "{n} inzendingen (en bijlagen) definitief verwijderen? Dit kan niet ongedaan worden gemaakt." }] : []),
          ]}
        />
      )}
      <DataTable base={`/admin/formulieren/${id}/inzendingen/`} params={lp} columns={cols} rows={rows} total={total} searchLabel="Zoek in inzendingen" selectForm={can(user, "user") ? "bulk-subs" : undefined} filters={[{ name: "gelezen", label: "Gelezen", options: [{ value: "nee", label: "Ongelezen" }, { value: "ja", label: "Gelezen" }] }]} />
    </>
  );
}
