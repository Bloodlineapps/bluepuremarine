import { DataTable, PER_PAGE, readParams, type Column } from "@/components/admin/DataTable";
import { Badge, PageHeader, fmtDateTime } from "@/components/admin/ui";
import { can, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { like } from "@/lib/search";
import type { AuditLog } from "@prisma/client";

export const metadata = { title: "Logboek" };

export default async function AuditAdmin({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  // connecties zijn onzichtbaar voor de rol Gebruiker, dus ook hun regels in het logboek
  const hide = can(user, "admin") ? {} : { NOT: { entity: "Connectie" } };
  const params = readParams(await searchParams, { sort: "createdAt" }, ["actie", "onderdeel"]);
  const where = {
    ...hide,
    ...(params.q ? { OR: [{ summary: like(params.q) }, { userName: like(params.q) }] } : {}),
    ...(params.filters.actie ? { action: params.filters.actie } : {}),
    ...(params.filters.onderdeel ? { entity: params.filters.onderdeel } : {}),
  };
  const [rows, total, entities] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: params.dir }, skip: (params.page - 1) * PER_PAGE, take: PER_PAGE }),
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where: hide, distinct: ["entity"], select: { entity: true }, orderBy: { entity: "asc" } }),
  ]);
  const cols: Column<AuditLog>[] = [
    { key: "createdAt", label: "Wanneer", sortable: true, render: (r) => fmtDateTime(r.createdAt) },
    { key: "userName", label: "Wie", render: (r) => r.userName },
    { key: "action", label: "Actie", render: (r) => <Badge tone={r.action === "verwijderd" ? "danger" : r.action === "aangemaakt" ? "success" : "neutral"}>{r.action}</Badge> },
    { key: "entity", label: "Onderdeel", render: (r) => r.entity },
    { key: "summary", label: "Wat", render: (r) => r.summary },
  ];
  return (
    <>
      <PageHeader title="Logboek" description="Wie heeft wat wanneer aangemaakt, gewijzigd of verwijderd." />
      <DataTable
        base="/admin/logboek/"
        params={params}
        columns={cols}
        rows={rows}
        total={total}
        searchLabel="Zoek in het logboek"
        filters={[
          { name: "actie", label: "Actie", options: ["aangemaakt", "gewijzigd", "verwijderd", "ingelogd", "getest", "verstuurd", "geïmporteerd", "geëxporteerd"].map((a) => ({ value: a, label: a })) },
          { name: "onderdeel", label: "Onderdeel", options: entities.map((e) => ({ value: e.entity, label: e.entity })) },
        ]}
      />
    </>
  );
}
