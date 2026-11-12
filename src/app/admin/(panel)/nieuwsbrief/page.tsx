import type { Subscriber } from "@prisma/client";
import { addSubscriber, bulkSubscribers } from "@/app/admin/actions/shop";
import { DataTable, PER_PAGE, readParams, type Column } from "@/components/admin/DataTable";
import { SimpleForm } from "@/components/admin/SimpleForm";
import { ShopBulkBar } from "@/components/admin/shop/ShopBulkBar";
import { SUBSCRIBER_FILTERS, exportQuery, subscriberWhere } from "@/components/admin/shop/queries";
import { Badge, Field, PageHeader, Panel, btnSm, fmtDateTime, input } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = { title: "Nieuwsbrief" };

// Nieuwsbriefaanmeldingen (tabel Subscriber, o.a. het formulier in de footer). Exporteer de lijst als CSV om hem in
// je e-mailprogramma te gebruiken.
export default async function NewsletterPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireUser("user");
  const sp = await searchParams;
  const params = readParams(sp, { sort: "createdAt", dir: "desc" }, SUBSCRIBER_FILTERS);
  const where = subscriberWhere(params.q, params.filters);
  const sort = ["email", "source", "createdAt"].includes(params.sort) ? params.sort : "createdAt";
  const [rows, total, all, sources] = await Promise.all([
    db.subscriber.findMany({ where, orderBy: [{ [sort]: params.dir }, { id: "asc" }], skip: (params.page - 1) * PER_PAGE, take: PER_PAGE }),
    db.subscriber.count({ where }),
    db.subscriber.findMany({ where, select: { id: true } }),
    db.subscriber.findMany({ distinct: ["source"], select: { source: true }, orderBy: { source: "asc" } }),
  ]);
  const cols: Column<Subscriber>[] = [
    {
      key: "email",
      label: "E-mailadres",
      sortable: true,
      render: (r) => (
        <a href={`mailto:${r.email}`} className="font-medium hover:underline">
          {r.email}
        </a>
      ),
    },
    { key: "source", label: "Bron", sortable: true, render: (r) => <Badge>{r.source}</Badge> },
    { key: "createdAt", label: "Aangemeld op", sortable: true, className: "whitespace-nowrap", render: (r) => fmtDateTime(r.createdAt) },
  ];
  return (
    <>
      <PageHeader
        title="Nieuwsbrief"
        description="Iedereen die zich heeft aangemeld voor de nieuwsbrief."
        action={
          <a href={`/api/admin/shop/subscribers-csv/${exportQuery(params.q, params.filters)}`} className={btnSm}>
            {params.q || Object.keys(params.filters).length ? "Exporteer dit filter (CSV)" : "Exporteer alles (CSV)"}
          </a>
        }
      />
      <ShopBulkBar
        formId="bulk-subscribers"
        action={bulkSubscribers}
        exportUrl="/api/admin/shop/subscribers-csv/"
        allIds={total > rows.length ? all.map((a) => a.id) : []}
        options={[{ value: "delete", label: "Verwijderen (afmelden)", confirm: "{n} aanmeldingen definitief verwijderen? Deze adressen krijgen dan geen nieuwsbrief meer." }]}
      />
      <DataTable base="/admin/nieuwsbrief/" params={params} columns={cols} rows={rows} total={total} searchLabel="Zoek op e-mailadres" selectForm="bulk-subscribers" filters={[{ name: "bron", label: "Bron", options: sources.map((s) => ({ value: s.source, label: s.source })) }]} />
      <Panel title="Aanmelding toevoegen" className="mt-6 max-w-md">
        <SimpleForm action={addSubscriber} submitLabel="Toevoegen" resetOnSuccess>
          <Field label="E-mailadres" hint="(alleen met toestemming van de ontvanger)">
            <input name="email" type="email" required className={input} />
          </Field>
        </SimpleForm>
      </Panel>
    </>
  );
}
