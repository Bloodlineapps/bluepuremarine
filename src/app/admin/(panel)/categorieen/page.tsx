import Link from "next/link";
import type { Category } from "@prisma/client";
import { bulkCategories, reorderCategories } from "@/app/admin/actions/shop";
import { DataTable, PER_PAGE, readParams, type Column } from "@/components/admin/DataTable";
import { CategoryTree, type TreeNode } from "@/components/admin/shop/CategoryTree";
import { ShopBulkBar } from "@/components/admin/shop/ShopBulkBar";
import { Badge, Notice, PageHeader, StatusBadge, btn, btnSm, input } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { like } from "@/lib/search";

export const metadata = { title: "Categorieën" };

type Row = Category & { count: number; parentName: string };

// Categorieën: standaard als boom (hoofd → sub) met drag & drop-volgorde; bij zoeken of filteren als lijst.
export default async function CategoriesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireUser("user");
  const sp = await searchParams;
  const params = readParams(sp, { sort: "path", dir: "asc" }, ["status", "niveau"]);
  const asList = !!params.q || Object.keys(params.filters).length > 0 || sp.weergave === "lijst";
  const [cats, links] = await Promise.all([
    db.category.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.productCategory.findMany({ where: { product: { deletedAt: null } }, select: { categoryId: true, productId: true } }),
  ]);
  // aantal producten per categorie; een hoofdcategorie telt de producten van haar subcategorieën mee
  const direct = new Map<string, Set<string>>();
  for (const l of links) (direct.get(l.categoryId) ?? direct.set(l.categoryId, new Set()).get(l.categoryId)!).add(l.productId);
  const countOf = (c: Category) => {
    const ids = new Set(direct.get(c.id) ?? []);
    for (const ch of cats.filter((x) => x.parentId === c.id)) for (const id of direct.get(ch.id) ?? []) ids.add(id);
    return ids.size;
  };
  const node = (c: Category): TreeNode => ({ id: c.id, name: c.name, path: c.path, status: c.status, highlight: c.highlight, menuGroup: c.menuGroup, count: countOf(c), children: cats.filter((x) => x.parentId === c.id).map(node) });
  const tree = cats.filter((c) => !c.parentId || !cats.some((x) => x.id === c.parentId)).map(node);

  const where = {
    deletedAt: null,
    ...(params.q ? { OR: [{ name: like(params.q) }, { path: like(params.q) }, { menuGroup: like(params.q) }] } : {}),
    ...(params.filters.status ? { status: params.filters.status } : {}),
    ...(params.filters.niveau === "hoofd" ? { parentId: null } : params.filters.niveau === "sub" ? { NOT: { parentId: null } } : {}),
  };
  const sort = ["name", "path", "status", "updatedAt"].includes(params.sort) ? params.sort : "path";
  const [found, total] = asList ? await Promise.all([db.category.findMany({ where, orderBy: { [sort]: params.dir }, skip: (params.page - 1) * PER_PAGE, take: PER_PAGE }), db.category.count({ where })]) : [[], 0];
  const rows: Row[] = found.map((c) => ({ ...c, count: countOf(c), parentName: cats.find((x) => x.id === c.parentId)?.name ?? "" }));
  const cols: Column<Row>[] = [
    {
      key: "name",
      label: "Naam",
      sortable: true,
      render: (r) => (
        <Link href={`/admin/categorieen/${r.id}/bewerken/`} className="font-medium hover:underline">
          {r.name}
        </Link>
      ),
    },
    {
      key: "path",
      label: "URL",
      sortable: true,
      render: (r) => (
        <a href={r.path} target="_blank" className="font-mono text-xs text-ink-soft hover:underline">
          {r.path}
        </a>
      ),
    },
    { key: "parent", label: "Valt onder", render: (r) => r.parentName || <span className="text-ink-soft">Hoofdcategorie</span> },
    { key: "group", label: "Menugroep", render: (r) => r.menuGroup || <span className="text-ink-soft">–</span> },
    { key: "count", label: "Producten", render: (r) => r.count },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (r) => (
        <span className="flex flex-wrap gap-1">
          <StatusBadge status={r.status} />
          {r.highlight && <Badge tone="brand">Accentkleur</Badge>}
          {r.noindex && <Badge>noindex</Badge>}
        </span>
      ),
    },
  ];
  return (
    <>
      <PageHeader title="Categorieën" description="De categorieën vormen het megamenu van de winkel: hoofdcategorieën met daaronder subcategorieën (maximaal twee niveaus)." />
      {sp.verwijderd && <Notice>Categorie naar de prullenbak verplaatst. Je kunt haar 6 maanden herstellen.</Notice>}
      <ShopBulkBar
        formId="bulk-categories"
        action={bulkCategories}
        allIds={[]}
        options={[
          { value: "publish", label: "Publiceren" },
          { value: "draft", label: "Naar concept", confirm: "{n} categorieën offline halen (concept)? Ze verdwijnen uit het menu." },
          { value: "trash", label: "Naar prullenbak", confirm: "{n} categorieën naar de prullenbak verplaatsen? De producten zelf blijven bestaan." },
        ]}
      />
      {asList ? (
        <>
          <DataTable
            base="/admin/categorieen/"
            params={params}
            columns={cols}
            rows={rows}
            total={total}
            searchLabel="Zoek op naam, URL of menugroep"
            selectForm="bulk-categories"
            filters={[
              { name: "status", label: "Status", options: [{ value: "published", label: "Gepubliceerd" }, { value: "draft", label: "Concept" }] },
              { name: "niveau", label: "Niveau", options: [{ value: "hoofd", label: "Hoofdcategorieën" }, { value: "sub", label: "Subcategorieën" }] },
            ]}
            newHref="/admin/categorieen/nieuw/"
            newLabel="Nieuwe categorie"
          />
          <p className="mt-4 text-sm">
            <Link href="/admin/categorieen/" className="underline">
              Terug naar de boomweergave (volgorde wijzigen)
            </Link>
          </p>
        </>
      ) : (
        <>
          <form action="/admin/categorieen/" className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-4" role="search">
            <label className="min-w-[200px] flex-1">
              <span className="sr-only">Zoeken</span>
              <input name="q" type="search" placeholder="Zoek op naam, URL of menugroep" className={input} />
            </label>
            <label>
              <span className="sr-only">Status</span>
              <select name="status" defaultValue="" className={input}>
                <option value="">Status: alle</option>
                <option value="published">Gepubliceerd</option>
                <option value="draft">Concept</option>
              </select>
            </label>
            <button className={btn}>Filter</button>
            <Link href="/admin/categorieen/?weergave=lijst" className={btnSm}>
              Lijstweergave
            </Link>
            <Link href="/admin/categorieen/nieuw/" className={`${btn} ml-auto`}>
              + Nieuwe categorie
            </Link>
          </form>
          {/* sleutel zonder volgorde: de boom laadt opnieuw na een bulkactie, maar niet na het slepen zelf */}
          <CategoryTree key={cats.map((c) => `${c.id}${c.status}${c.parentId ?? ""}`).sort().join()} nodes={tree} save={reorderCategories} formId="bulk-categories" />
        </>
      )}
    </>
  );
}
