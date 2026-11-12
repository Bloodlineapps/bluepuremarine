import Link from "next/link";
import { bulkContent, saveMeta } from "@/app/admin/actions/content";
import { BulkBar } from "@/components/admin/BulkBar";
import { DataTable, PER_PAGE, readParams, type Column } from "@/components/admin/DataTable";
import { MetaQuickEdit } from "@/components/admin/MetaQuickEdit";
import { Badge, Notice, PageHeader, StatusBadge, fmtDate } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { like } from "@/lib/search";
import type { Page } from "@prisma/client";
import { SECTIONS, TEMPLATES } from "@/lib/admin/labels";

export const metadata = { title: "Pagina's" };

export default async function PagesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireUser();
  const sp = await searchParams;
  const params = readParams(sp, { sort: "sortOrder", dir: "asc" }, ["status", "section", "seo"]);
  const where = {
    deletedAt: null,
    ...(params.q ? { OR: [{ title: like(params.q) }, { path: like(params.q) }] } : {}),
    ...(params.filters.status ? { status: params.filters.status } : {}),
    ...(params.filters.section ? { section: params.filters.section } : {}),
    ...(params.filters.seo === "zonder" ? { AND: [{ OR: [{ metaDescription: null }, { metaDescription: "" }] }] } : params.filters.seo === "noindex" ? { noindex: true } : {}),
  };
  const orderBy = [{ [["title", "path", "updatedAt", "status", "sortOrder"].includes(params.sort) ? params.sort : "sortOrder"]: params.dir }, { title: "asc" as const }];
  const [rows, total, all] = await Promise.all([db.page.findMany({ where, orderBy, skip: (params.page - 1) * PER_PAGE, take: PER_PAGE }), db.page.count({ where }), db.page.findMany({ where, select: { id: true } })]);
  const cols: Column<Page>[] = [
    {
      key: "title",
      label: "Titel",
      sortable: true,
      render: (r) => (
        <div>
          <Link href={`/admin/paginas/${r.id}/bewerken/`} className="font-medium hover:underline">
            {r.navTitle || r.title}
          </Link>
          <a href={r.path} target="_blank" className="block font-mono text-xs text-ink-soft hover:underline">
            {r.path}
          </a>
        </div>
      ),
    },
    {
      key: "section",
      label: "Onderdeel",
      render: (r) => (
        <span className="text-ink-soft">
          {SECTIONS[r.section] ?? r.section}
          {r.template !== "default" && <span className="block text-xs">{TEMPLATES[r.template] ?? r.template}</span>}
        </span>
      ),
    },
    { key: "meta", label: "Meta-title en -description", render: (r) => <MetaQuickEdit action={saveMeta.bind(null, "page", r.id)} metaTitle={r.metaTitle} metaDescription={r.metaDescription} fallbackTitle={r.title} /> },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (r) => (
        <span className="flex flex-wrap gap-1">
          <StatusBadge status={r.status} />
          {r.noindex && <Badge>noindex</Badge>}
          {r.isDraftCopy && <Badge tone="warning">concepttekst</Badge>}
        </span>
      ),
    },
    { key: "updatedAt", label: "Gewijzigd", sortable: true, render: (r) => fmtDate(r.updatedAt) },
  ];
  return (
    <>
      <PageHeader title="Pagina's" description="De vaste pagina's van de webshop: homepage, klantenservice, contact en de juridische pagina's. Producten, categorieën en blogs beheer je in hun eigen onderdeel." />
      {sp.verwijderd && <Notice>Pagina naar de prullenbak verplaatst. Je kunt hem 6 maanden herstellen.</Notice>}
      <BulkBar
        formId="bulk-pages"
        action={bulkContent.bind(null, "page")}
        allIds={total > rows.length ? all.map((a) => a.id) : []}
        options={[
          { value: "publish", label: "Publiceren" },
          { value: "draft", label: "Naar concept", confirm: "{n} pagina's offline halen (concept)?" },
          { value: "noindex-on", label: "Noindex aan" },
          { value: "noindex-off", label: "Noindex uit" },
          { value: "trash", label: "Naar prullenbak", confirm: "{n} pagina's naar de prullenbak verplaatsen?" },
        ]}
      />
      <DataTable
        base="/admin/paginas/"
        params={params}
        columns={cols}
        rows={rows}
        total={total}
        searchLabel="Zoek op titel of URL"
        selectForm="bulk-pages"
        filters={[
          { name: "status", label: "Status", options: [{ value: "published", label: "Gepubliceerd" }, { value: "draft", label: "Concept" }] },
          { name: "section", label: "Onderdeel", options: Object.entries(SECTIONS).map(([value, label]) => ({ value, label })) },
          { name: "seo", label: "SEO", options: [{ value: "zonder", label: "Meta-description ontbreekt" }, { value: "noindex", label: "Noindex" }] },
        ]}
        newHref="/admin/paginas/nieuw/"
        newLabel="Nieuwe pagina"
      />
      <p className="mt-4 text-sm text-ink-soft">
        <a href="/admin/export/paginas/" className="underline">
          Exporteer als CSV
        </a>
      </p>
    </>
  );
}
