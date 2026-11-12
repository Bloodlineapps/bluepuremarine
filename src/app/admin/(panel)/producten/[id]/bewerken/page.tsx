import Link from "next/link";
import { notFound } from "next/navigation";
import { duplicateProduct } from "@/app/admin/actions/shop";
import { EditExtras } from "@/components/admin/EditExtras";
import { ActionForm } from "@/components/admin/SimpleForm";
import { productFormOptions } from "@/components/admin/shop/queries";
import { Badge, Notice, PageHeader, btnSm } from "@/components/admin/ui";
import { aiEnabled } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProductForm } from "../../ProductForm";

export const metadata = { title: "Product bewerken" };

export default async function EditProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  await requireUser("user");
  const { id } = await params;
  const sp = await searchParams;
  const p = await db.product.findUnique({ where: { id }, include: { variants: { orderBy: { sortOrder: "asc" } }, categories: { select: { categoryId: true } } } });
  if (!p || p.deletedAt) notFound();
  const opts = await productFormOptions();
  return (
    <>
      <PageHeader
        title={p.name}
        description={
          <span>
            <span className="font-mono">{p.path}</span> · {p.sold} keer verkocht
          </span>
        }
        action={
          <>
            <ActionForm action={duplicateProduct.bind(null, p.id)} label="Dupliceren" />
            {p.status === "published" ? (
              <Link href={p.path} target="_blank" className={btnSm}>
                Bekijk op de site ↗
              </Link>
            ) : (
              <Badge tone="warning">Concept: niet zichtbaar op de site</Badge>
            )}
          </>
        }
      />
      {sp.nieuw && <Notice>Product aangemaakt.</Notice>}
      {sp.kopie && <Notice>Dit is een kopie (concept). Pas de naam, slug en SKU aan en publiceer het product daarna.</Notice>}
      {sp.teruggezet && <Notice>De eerdere versie is teruggezet.</Notice>}
      <ProductForm product={p} brands={opts.brands} categories={opts.categories} types={opts.types} aiEnabled={await aiEnabled()} />
      <EditExtras entity="product" id={p.id} canEdit />
    </>
  );
}
