import Link from "next/link";
import { moveToTrash } from "@/app/admin/actions/content";
import { duplicateForm } from "@/app/admin/actions/forms";
import { DataTable, PER_PAGE, readParams, type Column } from "@/components/admin/DataTable";
import { DeleteButton } from "@/components/admin/fields";
import { ActionForm } from "@/components/admin/SimpleForm";
import { Badge, Notice, PageHeader, StatusBadge, btnSm, fmtDateTime } from "@/components/admin/ui";
import { FIXED_FORMS } from "@/lib/admin/labels";
import { can, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseSteps } from "@/lib/forms";
import { like } from "@/lib/search";

export const metadata = { title: "Formulieren" };

const load = (where: object, orderBy: object, skip: number) => db.form.findMany({ where, orderBy, skip, take: PER_PAGE, include: { _count: { select: { submissions: true } }, submissions: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } } });
type Row = Awaited<ReturnType<typeof load>>[number];

export default async function FormsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const params = readParams(sp, { sort: "name", dir: "asc" });
  const where = { deletedAt: null, ...(params.q ? { OR: [{ name: like(params.q) }, { key: like(params.q) }] } : {}) };
  const orderBy = { [["name", "updatedAt", "key"].includes(params.sort) ? params.sort : "name"]: params.dir };
  const [rows, total, unread] = await Promise.all([load(where, orderBy, (params.page - 1) * PER_PAGE), db.form.count({ where }), db.formSubmission.groupBy({ by: ["formId"], where: { read: false }, _count: true })]);
  const admin = can(user, "user");
  const cols: Column<Row>[] = [
    {
      key: "name",
      label: "Formulier",
      sortable: true,
      render: (r) => (
        <div>
          <Link href={`/admin/formulieren/${r.id}/inzendingen/`} className="font-medium hover:underline">
            {r.name}
          </Link>
          <span className="block font-mono text-xs text-ink-soft">{r.key}</span>
        </div>
      ),
    },
    {
      key: "fields",
      label: "Opbouw",
      render: (r) => {
        const steps = parseSteps(r.steps);
        return (
          <span className="text-ink-soft">
            {steps.reduce((n, s) => n + s.fields.length, 0)} velden{steps.length > 1 ? `, ${steps.length} stappen` : ""}
          </span>
        );
      },
    },
    {
      key: "subs",
      label: "Inzendingen",
      render: (r) => {
        const n = unread.find((u) => u.formId === r.id)?._count ?? 0;
        return (
          <Link href={`/admin/formulieren/${r.id}/inzendingen/`} className="flex items-center gap-2 underline">
            {r._count.submissions}
            {n > 0 && <Badge tone="brand">{n} nieuw</Badge>}
          </Link>
        );
      },
    },
    { key: "last", label: "Laatste inzending", render: (r) => fmtDateTime(r.submissions[0]?.createdAt) },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions",
      label: "Acties",
      render: (r) =>
        admin ? (
          <div className="flex flex-wrap gap-1.5">
            <Link href={`/admin/formulieren/${r.id}/bewerken/`} className={btnSm}>
              Aanpassen
            </Link>
            <ActionForm action={duplicateForm.bind(null, r.id)} label="Dupliceren" />
            {!FIXED_FORMS.includes(r.key) && <DeleteButton action={moveToTrash.bind(null, "form", r.id)} label="Verwijderen" confirmText={`"${r.name}" naar de prullenbak? De inzendingen blijven bewaard en je kunt het formulier 6 maanden herstellen.`} />}
          </div>
        ) : null,
    },
  ];
  return (
    <>
      <PageHeader title="Formulieren" description="Alle formulieren van de webshop (zoals het contactformulier) met hun inzendingen. Inzendingen worden altijd opgeslagen, ook als een e-mail niet aankomt. Spambeveiliging: rate limiting, honeypot en minimale invultijd." />
      {sp.verwijderd && <Notice>Formulier naar de prullenbak verplaatst.</Notice>}
      <DataTable base="/admin/formulieren/" params={params} columns={cols} rows={rows} total={total} searchLabel="Zoek een formulier" newHref={admin ? "/admin/formulieren/nieuw/" : undefined} newLabel="Nieuw formulier" />
    </>
  );
}
