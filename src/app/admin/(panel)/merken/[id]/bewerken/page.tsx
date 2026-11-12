import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteBrand } from "@/app/admin/actions/shop";
import { DeleteButton } from "@/components/admin/fields";
import { Notice, PageHeader, Panel, btnSm } from "@/components/admin/ui";
import { aiEnabled } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BrandForm } from "../../BrandForm";

export const metadata = { title: "Merk bewerken" };

export default async function EditBrand({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  await requireUser("user");
  const { id } = await params;
  const sp = await searchParams;
  const b = await db.brand.findUnique({ where: { id }, include: { _count: { select: { products: { where: { deletedAt: null } } } } } });
  if (!b) notFound();
  const n = b._count.products;
  return (
    <>
      <PageHeader
        title={b.name}
        description={
          <span>
            <span className="font-mono">/merken/{b.slug}/</span> ·{" "}
            <Link href={`/admin/producten/?merk=${b.id}`} className="underline">
              {n} {n === 1 ? "product" : "producten"}
            </Link>
          </span>
        }
        action={
          <Link href={`/merken/${b.slug}/`} target="_blank" className={btnSm}>
            Bekijk op de site ↗
          </Link>
        }
      />
      {sp.nieuw && <Notice>Merk aangemaakt.</Notice>}
      <BrandForm brand={b} aiEnabled={await aiEnabled()} />
      <div className="mt-6 max-w-md">
        <Panel title="Verwijderen">
          <p className="mb-3 text-sm text-ink-soft">
            Het merk wordt definitief verwijderd. {n > 0 ? `De ${n} ${n === 1 ? "product blijft" : "producten blijven"} bestaan, maar ${n === 1 ? "heeft" : "hebben"} dan geen merk meer.` : "Er zijn geen producten aan dit merk gekoppeld."}
          </p>
          <DeleteButton action={deleteBrand.bind(null, b.id)} label="Merk verwijderen" confirmText={`${b.name} definitief verwijderen? Producten van dit merk houden dan geen merk. Dit kan niet ongedaan worden gemaakt.`} />
        </Panel>
      </div>
    </>
  );
}
