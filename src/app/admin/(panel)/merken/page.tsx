import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { bulkBrands, reorderBrands } from "@/app/admin/actions/shop";
import { DataTable, PER_PAGE, readParams, type Column } from "@/components/admin/DataTable";
import { SortableList } from "@/components/admin/SortableList";
import { ShopBulkBar } from "@/components/admin/shop/ShopBulkBar";
import { Badge, Notice, PageHeader, Panel } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { like } from "@/lib/search";

export const metadata = { title: "Merken" };

const include = { _count: { select: { products: { where: { deletedAt: null } } } } } satisfies Prisma.BrandInclude;
type Row = Prisma.BrandGetPayload<{ include: typeof include }>;

export default async function BrandsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireUser("user");
  const sp = await searchParams;
  const params = readParams(sp, { sort: "sortOrder", dir: "asc" }, ["seo", "producten"]);
  const where: Prisma.BrandWhereInput = {
    AND: [
      params.q ? { OR: [{ name: like(params.q) }, { slug: like(params.q) }] } : {},
      params.filters.seo === "zonder" ? { OR: [{ metaDescription: null }, { metaDescription: "" }] } : {},
      params.filters.producten === "zonder" ? { products: { none: { deletedAt: null } } } : params.filters.producten === "met" ? { products: { some: { deletedAt: null } } } : {},
    ],
  };
  const sort = ["name", "slug", "sortOrder", "updatedAt"].includes(params.sort) ? params.sort : "sortOrder";
  const [rows, total, all, ordered] = await Promise.all([
    db.brand.findMany({ where, include, orderBy: [{ [sort]: params.dir }, { name: "asc" }], skip: (params.page - 1) * PER_PAGE, take: PER_PAGE }),
    db.brand.count({ where }),
    db.brand.findMany({ where, select: { id: true } }),
    db.brand.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  const cols: Column<Row>[] = [
    {
      key: "logo",
      label: "Logo",
      className: "w-24",
      render: (r) =>
        r.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.logo} alt="" loading="lazy" className="h-9 w-20 object-contain" />
        ) : (
          <span className="text-xs text-ink-soft">geen logo</span>
        ),
    },
    {
      key: "name",
      label: "Naam",
      sortable: true,
      render: (r) => (
        <div>
          <Link href={`/admin/merken/${r.id}/bewerken/`} className="font-medium hover:underline">
            {r.name}
          </Link>
          <a href={`/merken/${r.slug}/`} target="_blank" className="block font-mono text-xs text-ink-soft hover:underline">
            /merken/{r.slug}/
          </a>
        </div>
      ),
    },
    {
      key: "products",
      label: "Producten",
      render: (r) =>
        r._count.products ? (
          <Link href={`/admin/producten/?merk=${r.id}`} className="underline">
            {r._count.products}
          </Link>
        ) : (
          <span className="text-ink-soft">0</span>
        ),
    },
    { key: "seo", label: "SEO", render: (r) => (r.metaDescription ? <Badge tone="success">Meta-description</Badge> : <Badge>Automatisch</Badge>) },
    { key: "sortOrder", label: "Volgorde", sortable: true, render: (r) => <span className="text-ink-soft">{r.sortOrder + 1}</span> },
  ];
  return (
    <>
      <PageHeader title="Merken" description="Merken staan op de merkenpagina, als filter in de winkel en bij elk product. Alleen merken met zichtbare producten verschijnen op de site." />
      {sp.verwijderd && <Notice>Merk verwijderd. De producten van dit merk bestaan nog, zonder merk.</Notice>}
      <ShopBulkBar formId="bulk-brands" action={bulkBrands} allIds={total > rows.length ? all.map((a) => a.id) : []} options={[{ value: "delete", label: "Verwijderen", confirm: "{n} merken definitief verwijderen? De producten blijven bestaan, maar hebben dan geen merk meer. Dit kan niet ongedaan worden gemaakt." }]} />
      <DataTable
        base="/admin/merken/"
        params={params}
        columns={cols}
        rows={rows}
        total={total}
        searchLabel="Zoek op naam"
        selectForm="bulk-brands"
        filters={[
          { name: "producten", label: "Producten", options: [{ value: "met", label: "Met producten" }, { value: "zonder", label: "Zonder producten" }] },
          { name: "seo", label: "SEO", options: [{ value: "zonder", label: "Meta-description ontbreekt" }] },
        ]}
        newHref="/admin/merken/nieuw/"
        newLabel="Nieuw merk"
      />
      {ordered.length > 1 && (
        <Panel title="Volgorde op de merkenpagina" className="mt-6">
          <SortableList key={ordered.map((b) => b.id).sort().join()} items={ordered.map((b) => ({ id: b.id, label: b.name }))} save={reorderBrands} />
        </Panel>
      )}
    </>
  );
}
