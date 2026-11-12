import Link from "next/link";
import type { Order } from "@prisma/client";
import { bulkOrders } from "@/app/admin/actions/shop";
import { DataTable, PER_PAGE, readParams, type Column } from "@/components/admin/DataTable";
import { ShopBulkBar } from "@/components/admin/shop/ShopBulkBar";
import { addressOf, fullName } from "@/components/admin/shop/format";
import { ORDER_FILTERS, PERIODS, exportQuery, orderWhere } from "@/components/admin/shop/queries";
import { Badge, PageHeader, btnSm, fmtDateTime } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/money";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/orders";

export const metadata = { title: "Bestellingen" };

// Bestellingen: zoeken op nummer, e-mail of naam; filteren op status, betaalstatus en periode. Bestellingen ontstaan
// alleen in de winkel; in het beheer kun je ze afhandelen (zie de detailpagina), niet aanmaken of verwijderen.
export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireUser("user");
  const sp = await searchParams;
  const params = readParams(sp, { sort: "createdAt", dir: "desc" }, ORDER_FILTERS);
  const where = orderWhere(params.q, params.filters);
  const sort = ["number", "createdAt", "total", "status", "paymentStatus", "email"].includes(params.sort) ? params.sort : "createdAt";
  const [rows, total, all, sum] = await Promise.all([
    db.order.findMany({ where, orderBy: [{ [sort]: params.dir }, { id: "asc" }], skip: (params.page - 1) * PER_PAGE, take: PER_PAGE }),
    db.order.count({ where }),
    db.order.findMany({ where, select: { id: true } }),
    db.order.aggregate({ where: { AND: [where, { paymentStatus: { in: ["paid", "partially_refunded"] } }] }, _sum: { total: true, refundedAmount: true } }),
  ]);
  const cols: Column<Order>[] = [
    {
      key: "number",
      label: "Nummer",
      sortable: true,
      render: (r) => (
        <Link href={`/admin/bestellingen/${r.id}/`} className="font-mono font-medium hover:underline">
          {r.number}
        </Link>
      ),
    },
    { key: "createdAt", label: "Datum", sortable: true, className: "whitespace-nowrap", render: (r) => fmtDateTime(r.createdAt) },
    {
      key: "email",
      label: "Klant",
      sortable: true,
      render: (r) => (
        <div>
          <span className="font-medium">{fullName(addressOf(r.billingAddress)) || fullName(addressOf(r.shippingAddress)) || "–"}</span>
          <span className="block text-xs text-ink-soft">{r.email}</span>
        </div>
      ),
    },
    {
      key: "total",
      label: "Totaal",
      sortable: true,
      className: "whitespace-nowrap",
      render: (r) => (
        <>
          {money(r.total)}
          {r.refundedAmount > 0 && <span className="block text-xs text-ink-soft">{money(r.refundedAmount)} terugbetaald</span>}
        </>
      ),
    },
    { key: "paymentStatus", label: "Betaling", sortable: true, render: (r) => <Badge tone={PAYMENT_STATUS[r.paymentStatus]?.tone}>{PAYMENT_STATUS[r.paymentStatus]?.label ?? r.paymentStatus}</Badge> },
    { key: "status", label: "Status", sortable: true, render: (r) => <Badge tone={ORDER_STATUS[r.status]?.tone}>{ORDER_STATUS[r.status]?.label ?? r.status}</Badge> },
  ];
  const paid = (sum._sum.total ?? 0) - (sum._sum.refundedAmount ?? 0);
  return (
    <>
      <PageHeader
        title="Bestellingen"
        description={`${total} ${total === 1 ? "bestelling" : "bestellingen"} in deze selectie, waarvan ${money(paid)} betaald (na terugbetalingen). Open een bestelling om haar te verzenden, af te ronden, te annuleren of terug te betalen.`}
        action={
          <a href={`/api/admin/shop/orders-csv/${exportQuery(params.q, params.filters)}`} className={btnSm}>
            {params.q || Object.keys(params.filters).length ? "Exporteer dit filter (CSV)" : "Exporteer alles (CSV)"}
          </a>
        }
      />
      <ShopBulkBar
        formId="bulk-orders"
        action={bulkOrders}
        exportUrl="/api/admin/shop/orders-csv/"
        allIds={total > rows.length ? all.map((a) => a.id) : []}
        options={[{ value: "complete", label: "Markeren als afgerond", confirm: "{n} bestellingen markeren als afgerond? Dat kan alleen bij betaalde of verzonden bestellingen." }]}
      />
      <DataTable
        base="/admin/bestellingen/"
        params={params}
        columns={cols}
        rows={rows}
        total={total}
        searchLabel="Zoek op bestelnummer, e-mail of naam"
        selectForm="bulk-orders"
        filters={[
          { name: "status", label: "Status", options: Object.entries(ORDER_STATUS).map(([value, s]) => ({ value, label: s.label })) },
          { name: "betaling", label: "Betaling", options: Object.entries(PAYMENT_STATUS).map(([value, s]) => ({ value, label: s.label })) },
          { name: "periode", label: "Periode", options: Object.entries(PERIODS).map(([value, label]) => ({ value, label })) },
        ]}
      />
    </>
  );
}
