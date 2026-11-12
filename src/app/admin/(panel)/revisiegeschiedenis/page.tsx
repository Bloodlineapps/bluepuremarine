import Link from "next/link";
import { DataTable, PER_PAGE, readParams, type Column } from "@/components/admin/DataTable";
import { Badge, PageHeader, fmtDateTime } from "@/components/admin/ui";
import { ENTITY_LABEL, type Entity } from "@/lib/admin/revisions";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { like } from "@/lib/search";
import type { Revision } from "@prisma/client";

export const metadata = { title: "Revisiegeschiedenis" };

export default async function Revisions({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireUser();
  const sp = await searchParams;
  const params = readParams(sp, { sort: "createdAt", dir: "desc" }, ["type", "gebruiker"]);
  const where = {
    ...(params.q ? { OR: [{ title: like(params.q) }, { changes: like(params.q) }] } : {}),
    ...(params.filters.type ? { entity: params.filters.type } : {}),
    ...(params.filters.gebruiker ? { userName: params.filters.gebruiker } : {}),
    ...(sp.van || sp.tot ? { createdAt: { ...(sp.van ? { gte: new Date(`${sp.van}T00:00:00`) } : {}), ...(sp.tot ? { lte: new Date(`${sp.tot}T23:59:59`) } : {}) } } : {}),
  };
  const [rows, total, users] = await Promise.all([db.revision.findMany({ where, orderBy: { createdAt: params.dir }, skip: (params.page - 1) * PER_PAGE, take: PER_PAGE }), db.revision.count({ where }), db.revision.findMany({ distinct: ["userName"], select: { userName: true }, orderBy: { userName: "asc" } })]);
  const cols: Column<Revision>[] = [
    { key: "createdAt", label: "Wanneer", sortable: true, render: (r) => fmtDateTime(r.createdAt) },
    { key: "entity", label: "Type", render: (r) => <Badge>{ENTITY_LABEL[r.entity as Entity] ?? r.entity}</Badge> },
    {
      key: "title",
      label: "Item",
      render: (r) => (
        <Link href={`/admin/revisiegeschiedenis/${r.entity}/${r.entityId}/?a=${r.id}`} className="font-medium hover:underline">
          {r.title}
        </Link>
      ),
    },
    { key: "changes", label: "Wat is er veranderd", render: (r) => <span className="text-ink-soft">{r.changes || "–"}</span> },
    { key: "userName", label: "Door", render: (r) => r.userName },
  ];
  return (
    <>
      <PageHeader title="Revisiegeschiedenis" description="Elke wijziging aan pagina's, producten, categorieën, blogs, veelgestelde vragen en formulieren wordt bewaard. Open een item om twee versies te vergelijken of een eerdere versie terug te zetten." />
      <form action="/admin/revisiegeschiedenis/" className="mb-3 flex flex-wrap items-end gap-3 text-sm">
        <label>
          Van <input type="date" name="van" defaultValue={sp.van ?? ""} className="rounded-lg border border-line px-2 py-1.5" />
        </label>
        <label>
          Tot <input type="date" name="tot" defaultValue={sp.tot ?? ""} className="rounded-lg border border-line px-2 py-1.5" />
        </label>
        {params.filters.type && <input type="hidden" name="type" value={params.filters.type} />}
        {params.filters.gebruiker && <input type="hidden" name="gebruiker" value={params.filters.gebruiker} />}
        {params.q && <input type="hidden" name="q" value={params.q} />}
        <button className="rounded-full border border-line bg-white px-3 py-1.5">Datum filteren</button>
        {(sp.van || sp.tot) && (
          <Link href="/admin/revisiegeschiedenis/" className="underline">
            Datum wissen
          </Link>
        )}
      </form>
      <DataTable
        base="/admin/revisiegeschiedenis/"
        params={params}
        columns={cols}
        rows={rows}
        total={total}
        searchLabel="Zoek op titel of veld"
        hidden={{ ...(sp.van ? { van: sp.van } : {}), ...(sp.tot ? { tot: sp.tot } : {}) }}
        filters={[
          { name: "type", label: "Type", options: Object.entries(ENTITY_LABEL).map(([value, label]) => ({ value, label })) },
          { name: "gebruiker", label: "Gebruiker", options: users.map((u) => ({ value: u.userName, label: u.userName })) },
        ]}
      />
    </>
  );
}
