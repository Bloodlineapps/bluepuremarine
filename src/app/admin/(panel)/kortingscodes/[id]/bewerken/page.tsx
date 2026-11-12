import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteDiscount } from "@/app/admin/actions/shop";
import { DeleteButton } from "@/components/admin/fields";
import { DISCOUNT_TYPES } from "@/components/admin/shop/format";
import { Notice, PageHeader, Panel, btnSm } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DiscountForm } from "../../DiscountForm";

export const metadata = { title: "Kortingscode bewerken" };

export default async function EditDiscount({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  await requireUser("user");
  const { id } = await params;
  const sp = await searchParams;
  const d = await db.discount.findUnique({ where: { id } });
  if (!d) notFound();
  return (
    <>
      <PageHeader
        title={d.code}
        description={`${DISCOUNT_TYPES[d.type] ?? d.type} · ${d.used} keer gebruikt`}
        action={
          <Link href="/admin/kortingscodes/" className={btnSm}>
            Alle kortingscodes
          </Link>
        }
      />
      {sp.nieuw && <Notice>Kortingscode aangemaakt.</Notice>}
      <DiscountForm discount={d} />
      <div className="mt-6 max-w-md">
        <Panel title="Verwijderen">
          <p className="mb-3 text-sm text-ink-soft">De code wordt definitief verwijderd en werkt dan niet meer. Bestellingen waarin de code is gebruikt blijven ongewijzigd. Tijdelijk stoppen? Zet dan Actief uit.</p>
          <DeleteButton action={deleteDiscount.bind(null, d.id)} label="Kortingscode verwijderen" confirmText={`Kortingscode ${d.code} definitief verwijderen? Dit kan niet ongedaan worden gemaakt.`} />
        </Panel>
      </div>
    </>
  );
}
