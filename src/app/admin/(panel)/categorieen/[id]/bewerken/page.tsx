import Link from "next/link";
import { notFound } from "next/navigation";
import { reorderCategoryProducts, trashCategory } from "@/app/admin/actions/shop";
import { EditExtras } from "@/components/admin/EditExtras";
import { SortableList } from "@/components/admin/SortableList";
import { DeleteButton } from "@/components/admin/fields";
import { Badge, Notice, PageHeader, Panel, btnSm } from "@/components/admin/ui";
import { aiEnabled } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CategoryForm } from "../../CategoryForm";

export const metadata = { title: "Categorie bewerken" };

export default async function EditCategory({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  await requireUser("user");
  const { id } = await params;
  const sp = await searchParams;
  const c = await db.category.findUnique({ where: { id } });
  if (!c || c.deletedAt) notFound();
  const [parents, groups, children, products] = await Promise.all([
    db.category.findMany({ where: { deletedAt: null, parentId: null, NOT: { id } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, path: true } }),
    db.category.findMany({ where: { deletedAt: null, NOT: { menuGroup: "" } }, distinct: ["menuGroup"], select: { menuGroup: true } }),
    db.category.findMany({ where: { parentId: id, deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, path: true } }),
    db.productCategory.findMany({ where: { categoryId: id, product: { deletedAt: null } }, orderBy: [{ position: "asc" }, { product: { name: "asc" } }], select: { product: { select: { id: true, name: true, sku: true, status: true } } } }),
  ]);
  return (
    <>
      <PageHeader
        title={c.name}
        description={<span className="font-mono">{c.path}</span>}
        action={
          <>
            {!c.parentId && (
              <Link href={`/admin/categorieen/nieuw/?onder=${c.id}`} className={btnSm}>
                + Subcategorie
              </Link>
            )}
            {c.status === "published" ? (
              <Link href={c.path} target="_blank" className={btnSm}>
                Bekijk op de site ↗
              </Link>
            ) : (
              <Badge tone="warning">Concept: niet zichtbaar op de site</Badge>
            )}
          </>
        }
      />
      {sp.nieuw && <Notice>Categorie aangemaakt.</Notice>}
      {sp.teruggezet && <Notice>De eerdere versie is teruggezet.</Notice>}
      <CategoryForm category={c} parents={parents} groups={groups.map((g) => g.menuGroup)} hasChildren={children.length > 0} aiEnabled={await aiEnabled()} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <Panel title={`Volgorde van de producten (${products.length})`}>
          {products.length > 1 ? (
            <>
              <p className="mb-3 text-sm text-ink-soft">Sleep de producten in de volgorde waarin ze in deze categorie moeten staan en sla de volgorde op.</p>
              <SortableList key={products.map((p) => p.product.id).sort().join()} items={products.map((p) => ({ id: p.product.id, label: p.product.name, sub: [p.product.sku, p.product.status === "draft" ? "concept" : ""].filter(Boolean).join(" · ") || undefined }))} save={reorderCategoryProducts.bind(null, c.id)} />
            </>
          ) : (
            <p className="text-sm text-ink-soft">{products.length ? "Er staat één product in deze categorie." : "Er staan nog geen producten in deze categorie. Koppel producten via het productformulier (Indeling)."}</p>
          )}
        </Panel>
        <div className="space-y-6">
          {children.length > 0 && (
            <Panel title="Subcategorieën">
              <ul className="space-y-1.5 text-sm">
                {children.map((s) => (
                  <li key={s.id}>
                    <Link href={`/admin/categorieen/${s.id}/bewerken/`} className="font-medium hover:underline">
                      {s.name}
                    </Link>
                    <span className="block font-mono text-xs text-ink-soft">{s.path}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel title="Verwijderen">
            {children.length > 0 ? (
              <p className="text-sm text-ink-soft">Deze categorie heeft nog subcategorieën. Verplaats of verwijder die eerst; daarna kan deze categorie naar de prullenbak.</p>
            ) : (
              <>
                <p className="mb-3 text-sm text-ink-soft">De categorie gaat naar de prullenbak en blijft daar 6 maanden bewaard. De producten zelf blijven bestaan.</p>
                <DeleteButton action={trashCategory.bind(null, c.id)} label="Naar de prullenbak" confirmText="Categorie naar de prullenbak verplaatsen? Je kunt haar 6 maanden lang herstellen." />
              </>
            )}
          </Panel>
        </div>
      </div>
      <EditExtras entity="category" id={c.id} canEdit canTrash={false} />
    </>
  );
}
