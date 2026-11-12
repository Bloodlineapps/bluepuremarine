import Link from "next/link";
import type { Customer } from "@prisma/client";
import { bulkCustomers } from "@/app/admin/actions/shop";
import { DataTable, PER_PAGE, readParams, type Column } from "@/components/admin/DataTable";
import { ShopBulkBar } from "@/components/admin/shop/ShopBulkBar";
import { CUSTOMER_FILTERS, customerStats, customerWhere, exportQuery } from "@/components/admin/shop/queries";
import { Badge, Notice, PageHeader, btnSm, fmtDate, fmtDateTime } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/money";

export const metadata = { title: "Klanten" };

type Row = Customer & { count: number; spent: number };

// Klantaccounts (aangemaakt door klanten zelf in de winkel). Wachtwoorden zijn versleuteld opgeslagen en worden nergens getoond.
export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireUser("user");
  const sp = await searchParams;
  const params = readParams(sp, { sort: "createdAt", dir: "desc" }, CUSTOMER_FILTERS);
  const where = customerWhere(params.q, params.filters);
  const sort = ["lastName", "email", "lastLoginAt", "createdAt"].includes(params.sort) ? params.sort : "createdAt";
  const [found, total, all] = await Promise.all([db.customer.findMany({ where, orderBy: [{ [sort]: params.dir }, { id: "asc" }], skip: (params.page - 1) * PER_PAGE, take: PER_PAGE }), db.customer.count({ where }), db.customer.findMany({ where, select: { id: true } })]);
  const stats = await customerStats(found.map((c) => c.id));
  const rows: Row[] = found.map((c) => ({ ...c, count: stats.get(c.id)?.count ?? 0, spent: stats.get(c.id)?.spent ?? 0 }));
  const cols: Column<Row>[] = [
    {
      key: "lastName",
      label: "Naam",
      sortable: true,
      render: (r) => (
        <Link href={`/admin/klanten/${r.id}/`} className="font-medium hover:underline">
          {r.firstName} {r.lastName}
        </Link>
      ),
    },
    { key: "email", label: "E-mail", sortable: true, render: (r) => r.email },
    { key: "count", label: "Bestellingen", render: (r) => r.count },
    { key: "spent", label: "Totaal besteed", className: "whitespace-nowrap", render: (r) => money(r.spent) },
    { key: "lastLoginAt", label: "Laatste login", sortable: true, className: "whitespace-nowrap", render: (r) => (r.lastLoginAt ? fmtDateTime(r.lastLoginAt) : <span className="text-ink-soft">nooit</span>) },
    { key: "newsletter", label: "Nieuwsbrief", render: (r) => (r.newsletter ? <Badge tone="success">Ja</Badge> : <Badge>Nee</Badge>) },
    { key: "createdAt", label: "Klant sinds", sortable: true, className: "whitespace-nowrap", render: (r) => fmtDate(r.createdAt) },
  ];
  return (
    <>
      <PageHeader
        title="Klanten"
        description="Klanten met een account in de winkel. Bestellingen zonder account vind je alleen onder Bestellingen."
        action={
          <a href={`/api/admin/shop/customers-csv/${exportQuery(params.q, params.filters)}`} className={btnSm}>
            {params.q || Object.keys(params.filters).length ? "Exporteer dit filter (CSV)" : "Exporteer alles (CSV)"}
          </a>
        }
      />
      {sp.verwijderd && <Notice>Klantaccount verwijderd. De bestellingen van deze klant zijn bewaard gebleven.</Notice>}
      <ShopBulkBar
        formId="bulk-customers"
        action={bulkCustomers}
        exportUrl="/api/admin/shop/customers-csv/"
        allIds={total > rows.length ? all.map((a) => a.id) : []}
        options={[{ value: "delete", label: "Verwijderen", confirm: "{n} klantaccounts definitief verwijderen? De bestellingen blijven bewaard, zonder koppeling met een account. Dit kan niet ongedaan worden gemaakt." }]}
      />
      <DataTable
        base="/admin/klanten/"
        params={params}
        columns={cols}
        rows={rows}
        total={total}
        searchLabel="Zoek op naam, e-mail of telefoon"
        selectForm="bulk-customers"
        filters={[{ name: "nieuwsbrief", label: "Nieuwsbrief", options: [{ value: "ja", label: "Aangemeld" }, { value: "nee", label: "Niet aangemeld" }] }]}
      />
    </>
  );
}
