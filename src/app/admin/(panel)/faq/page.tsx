import Link from "next/link";
import type { Faq } from "@prisma/client";
import { bulkContent, reorderFaqs } from "@/app/admin/actions/content";
import { BulkBar } from "@/components/admin/BulkBar";
import { DataTable, PER_PAGE, readParams, type Column } from "@/components/admin/DataTable";
import { SortableList } from "@/components/admin/SortableList";
import { Badge, Notice, PageHeader, Panel, StatusBadge, fmtDate } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { like } from "@/lib/search";

export const metadata = { title: "Veelgestelde vragen" };

// Veelgestelde vragen: zoeken, filteren, sorteren, bulkacties en de volgorde slepen. De vragen staan op
// /veelgestelde-vragen/ (blok "Veelgestelde vragen") en als FAQPage in de structured data.
export default async function FaqList({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireUser();
  const sp = await searchParams;
  const params = readParams(sp, { sort: "sortOrder", dir: "asc" }, ["status", "categorie"]);
  const where = {
    deletedAt: null,
    ...(params.q ? { OR: [{ question: like(params.q) }, { answer: like(params.q) }] } : {}),
    ...(params.filters.status ? { status: params.filters.status } : {}),
    ...(params.filters.categorie ? { category: params.filters.categorie } : {}),
  };
  const orderBy = { [["question", "sortOrder", "updatedAt", "status"].includes(params.sort) ? params.sort : "sortOrder"]: params.dir };
  const [rows, total, all, cats, ordered] = await Promise.all([
    db.faq.findMany({ where, orderBy, skip: (params.page - 1) * PER_PAGE, take: PER_PAGE }),
    db.faq.count({ where }),
    db.faq.findMany({ where, select: { id: true } }),
    db.faq.findMany({ where: { deletedAt: null }, distinct: ["category"], select: { category: true } }),
    db.faq.findMany({ where: { deletedAt: null }, orderBy: { sortOrder: "asc" }, select: { id: true, question: true, category: true, status: true } }),
  ]);
  const cols: Column<Faq>[] = [
    { key: "sortOrder", label: "#", sortable: true, render: (r) => <span className="text-ink-soft">{r.sortOrder + 1}</span> },
    {
      key: "question",
      label: "Vraag",
      sortable: true,
      render: (r) => (
        <Link href={`/admin/faq/${r.id}/bewerken/`} className="font-medium hover:underline">
          {r.question}
        </Link>
      ),
    },
    { key: "category", label: "Categorie", render: (r) => <Badge>{r.category}</Badge> },
    { key: "status", label: "Status", sortable: true, render: (r) => <StatusBadge status={r.status} /> },
    { key: "updatedAt", label: "Gewijzigd", sortable: true, render: (r) => fmtDate(r.updatedAt) },
  ];
  return (
    <>
      <PageHeader title="Veelgestelde vragen" description="Alleen gepubliceerde vragen staan op de pagina Veelgestelde vragen en in de FAQPage-structured data." />
      {sp.verwijderd && <Notice>Vraag naar de prullenbak verplaatst.</Notice>}
      <BulkBar
        formId="bulk-faq"
        action={bulkContent.bind(null, "faq")}
        allIds={total > rows.length ? all.map((a) => a.id) : []}
        options={[
          { value: "publish", label: "Publiceren" },
          { value: "draft", label: "Naar concept", confirm: "{n} vragen offline halen?" },
          { value: "trash", label: "Naar prullenbak", confirm: "{n} vragen naar de prullenbak verplaatsen?" },
        ]}
      />
      <DataTable
        base="/admin/faq/"
        params={params}
        columns={cols}
        rows={rows}
        total={total}
        searchLabel="Zoek in vraag of antwoord"
        selectForm="bulk-faq"
        filters={[
          { name: "status", label: "Status", options: [{ value: "published", label: "Gepubliceerd" }, { value: "draft", label: "Concept" }] },
          { name: "categorie", label: "Categorie", options: cats.map((c) => ({ value: c.category, label: c.category })) },
        ]}
        newHref="/admin/faq/nieuw/"
        newLabel="Nieuwe vraag"
      />
      {ordered.length > 1 && (
        <Panel title="Volgorde op de website" className="mt-6">
          <SortableList items={ordered.map((f) => ({ id: f.id, label: f.question, sub: `${f.category}${f.status === "draft" ? " · concept" : ""}` }))} save={reorderFaqs} />
        </Panel>
      )}
      <p className="mt-4 text-sm text-ink-soft">
        <a href="/admin/export/faq/" className="underline">
          Exporteer als CSV
        </a>
      </p>
    </>
  );
}
