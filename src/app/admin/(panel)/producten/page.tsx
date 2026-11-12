import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { bulkProducts } from "@/app/admin/actions/shop";
import { DataTable, PER_PAGE, readParams, type Column } from "@/components/admin/DataTable";
import { ShopBulkBar } from "@/components/admin/shop/ShopBulkBar";
import { stockTone } from "@/components/admin/shop/format";
import { PRODUCT_FILTERS, categoryOptions, exportQuery, productWhere } from "@/components/admin/shop/queries";
import { Badge, Notice, PageHeader, StatusBadge, btnSm } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/money";
import { imagesOf } from "@/lib/shop";

export const metadata = { title: "Producten" };

const include = { brand: { select: { name: true } }, primaryCategory: { select: { name: true } }, _count: { select: { variants: true } } } satisfies Prisma.ProductInclude;
type Row = Prisma.ProductGetPayload<{ include: typeof include }>;

// Productoverzicht: zoeken, filteren op status, merk, categorie en voorraad, sorteren, bulkacties en CSV-export/-import.
export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireUser("user");
  const sp = await searchParams;
  const params = readParams(sp, { sort: "name", dir: "asc" }, PRODUCT_FILTERS);
  const where = await productWhere(params.q, params.filters);
  const orderBy = [{ [["name", "sku", "price", "stock", "status", "updatedAt"].includes(params.sort) ? params.sort : "name"]: params.dir }, { id: "asc" as const }];
  const [rows, total, all, brands, categories] = await Promise.all([
    db.product.findMany({ where, orderBy, include, skip: (params.page - 1) * PER_PAGE, take: PER_PAGE }),
    db.product.count({ where }),
    db.product.findMany({ where, select: { id: true } }),
    db.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    categoryOptions(),
  ]);
  const cols: Column<Row>[] = [
    {
      key: "image",
      label: "Afbeelding",
      className: "w-16",
      render: (r) => {
        const img = imagesOf(r)[0];
        return img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img.src} alt="" loading="lazy" className="h-11 w-11 rounded-lg border border-line bg-white object-contain" />
        ) : (
          <span className="grid h-11 w-11 place-items-center rounded-lg border border-dashed border-line text-[0.6rem] text-ink-soft">geen</span>
        );
      },
    },
    {
      key: "name",
      label: "Naam",
      sortable: true,
      render: (r) => (
        <div className="min-w-[200px]">
          <Link href={`/admin/producten/${r.id}/bewerken/`} className="font-medium hover:underline">
            {r.name}
          </Link>
          <a href={r.path} target="_blank" className="block font-mono text-xs text-ink-soft hover:underline">
            {r.path}
          </a>
        </div>
      ),
    },
    { key: "sku", label: "SKU", sortable: true, render: (r) => <span className="font-mono text-xs">{r.sku ?? "–"}</span> },
    { key: "brand", label: "Merk", render: (r) => r.brand?.name ?? <span className="text-ink-soft">–</span> },
    { key: "category", label: "Hoofdcategorie", render: (r) => r.primaryCategory?.name ?? <span className="text-ink-soft">–</span> },
    {
      key: "price",
      label: "Prijs",
      sortable: true,
      className: "whitespace-nowrap",
      render: (r) => (
        <>
          {r._count.variants > 0 && <span className="text-xs text-ink-soft">vanaf </span>}
          {money(r.price)}
          {r.compareAtPrice != null && r.compareAtPrice > r.price && <span className="ml-1.5 text-xs text-ink-soft line-through">{money(r.compareAtPrice)}</span>}
        </>
      ),
    },
    { key: "stock", label: "Voorraad", sortable: true, render: (r) => <span className={stockTone(r)}>{r.trackStock ? r.stock : "n.v.t."}</span> },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (r) => (
        <span className="flex flex-wrap gap-1">
          <StatusBadge status={r.status} />
          {r.featured && <Badge tone="brand">Uitgelicht</Badge>}
          {r._count.variants > 0 && <Badge>{r._count.variants} varianten</Badge>}
        </span>
      ),
    },
  ];
  return (
    <>
      <PageHeader
        title="Producten"
        description="Alle producten van de winkel. Voorraad in rood is uitverkocht, in oranje bijna op (3 of minder)."
        action={
          <>
            <Link href="/admin/producten/import/" className={btnSm}>
              Importeren (CSV)
            </Link>
            <a href={`/api/admin/shop/products-csv/${exportQuery(params.q, params.filters)}`} className={btnSm}>
              {params.q || Object.keys(params.filters).length ? "Exporteer dit filter (CSV)" : "Exporteer alles (CSV)"}
            </a>
          </>
        }
      />
      {sp.verwijderd && <Notice>Product naar de prullenbak verplaatst. Je kunt het 6 maanden herstellen.</Notice>}
      <ShopBulkBar
        formId="bulk-products"
        action={bulkProducts}
        exportUrl="/api/admin/shop/products-csv/"
        allIds={total > rows.length ? all.map((a) => a.id) : []}
        options={[
          { value: "publish", label: "Publiceren" },
          { value: "draft", label: "Naar concept", confirm: "{n} producten offline halen (concept)? Ze zijn dan niet meer te bestellen." },
          { value: "featured-on", label: "Uitgelicht aan" },
          { value: "featured-off", label: "Uitgelicht uit" },
          { value: "trash", label: "Naar prullenbak", confirm: "{n} producten naar de prullenbak verplaatsen?" },
        ]}
      />
      <DataTable
        base="/admin/producten/"
        params={params}
        columns={cols}
        rows={rows}
        total={total}
        searchLabel="Zoek op naam, SKU, EAN of merk"
        selectForm="bulk-products"
        filters={[
          { name: "status", label: "Status", options: [{ value: "published", label: "Gepubliceerd" }, { value: "draft", label: "Concept" }] },
          { name: "merk", label: "Merk", options: [...brands.map((b) => ({ value: b.id, label: b.name })), { value: "geen", label: "Zonder merk" }] },
          { name: "categorie", label: "Categorie", options: categories.flatMap((c) => [{ value: c.id, label: c.name }, ...c.children.map((s) => ({ value: s.id, label: `${c.name} › ${s.name}` }))]) },
          { name: "voorraad", label: "Voorraad", options: [{ value: "op-voorraad", label: "Op voorraad" }, { value: "bijna-op", label: "Bijna op (3 of minder)" }, { value: "uitverkocht", label: "Uitverkocht" }] },
        ]}
        newHref="/admin/producten/nieuw/"
        newLabel="Nieuw product"
      />
    </>
  );
}
