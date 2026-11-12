import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteReview } from "@/app/admin/actions/shop";
import { DeleteButton } from "@/components/admin/fields";
import { REVIEW_STATUS, stars } from "@/components/admin/shop/format";
import { Badge, Notice, PageHeader, Panel, btnSm } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ReviewForm } from "../../ReviewForm";

export const metadata = { title: "Review bewerken" };

export default async function EditReview({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  await requireUser("user");
  const { id } = await params;
  const sp = await searchParams;
  const [r, products] = await Promise.all([db.review.findUnique({ where: { id } }), db.product.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } })]);
  if (!r) notFound();
  return (
    <>
      <PageHeader
        title={`Review van ${r.name}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[#c98a00]">{stars(r.rating)}</span>
            <Badge tone={REVIEW_STATUS[r.status]?.tone}>{REVIEW_STATUS[r.status]?.label ?? r.status}</Badge>
          </span>
        }
        action={
          <Link href="/admin/reviews/" className={btnSm}>
            Alle reviews
          </Link>
        }
      />
      {sp.nieuw && <Notice>Review toegevoegd.</Notice>}
      <ReviewForm review={r} products={products} />
      <div className="mt-6 max-w-md">
        <Panel title="Verwijderen">
          <p className="mb-3 text-sm text-ink-soft">De review wordt definitief verwijderd. Wil je hem alleen van de site halen? Zet de status dan op Afgewezen.</p>
          <DeleteButton action={deleteReview.bind(null, r.id, true)} label="Review verwijderen" confirmText={`De review van ${r.name} definitief verwijderen? Dit kan niet ongedaan worden gemaakt.`} />
        </Panel>
      </div>
    </>
  );
}
