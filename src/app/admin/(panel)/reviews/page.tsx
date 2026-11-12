import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { bulkReviews, deleteReview, setReviewStatus } from "@/app/admin/actions/shop";
import { DataTable, PER_PAGE, readParams, type Column } from "@/components/admin/DataTable";
import { ActionForm } from "@/components/admin/SimpleForm";
import { DeleteButton } from "@/components/admin/fields";
import { ShopBulkBar } from "@/components/admin/shop/ShopBulkBar";
import { REVIEW_STATUS, stars } from "@/components/admin/shop/format";
import { Badge, Notice, PageHeader, fmtDate } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { like } from "@/lib/search";
import { reviewSummary } from "@/lib/shop";
import { clip } from "@/lib/text";

export const metadata = { title: "Reviews" };

const include = { product: { select: { id: true, name: true } } } satisfies Prisma.ReviewInclude;
type Row = Prisma.ReviewGetPayload<{ include: typeof include }>;

// Reviews: nieuwe inzendingen wachten op beoordeling; alleen goedgekeurde reviews staan op de site en tellen mee in het cijfer.
export default async function ReviewsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireUser("user");
  const sp = await searchParams;
  const params = readParams(sp, { sort: "date", dir: "desc" }, ["status", "score", "geverifieerd"]);
  const where: Prisma.ReviewWhereInput = {
    ...(params.q ? { OR: [{ name: like(params.q) }, { title: like(params.q) }, { text: like(params.q) }, { product: { name: like(params.q) } }] } : {}),
    ...(params.filters.status ? { status: params.filters.status } : {}),
    ...(Number(params.filters.score) ? { rating: Number(params.filters.score) } : {}),
    ...(params.filters.geverifieerd === "ja" ? { verified: true } : params.filters.geverifieerd === "nee" ? { verified: false } : {}),
  };
  const sort = ["name", "rating", "date", "status"].includes(params.sort) ? params.sort : "date";
  const [rows, total, all, pending, summary] = await Promise.all([
    db.review.findMany({ where, include, orderBy: [{ [sort]: params.dir }, { id: "asc" }], skip: (params.page - 1) * PER_PAGE, take: PER_PAGE }),
    db.review.count({ where }),
    db.review.findMany({ where, select: { id: true } }),
    db.review.count({ where: { status: "pending" } }),
    reviewSummary(),
  ]);
  const cols: Column<Row>[] = [
    {
      key: "name",
      label: "Naam",
      sortable: true,
      render: (r) => (
        <div>
          <Link href={`/admin/reviews/${r.id}/bewerken/`} className="font-medium hover:underline">
            {r.name}
          </Link>
          {r.verified && <span className="block text-xs text-success">Geverifieerde koper</span>}
        </div>
      ),
    },
    {
      key: "rating",
      label: "Score",
      sortable: true,
      className: "whitespace-nowrap",
      render: (r) => (
        <span className="text-[#c98a00]" role="img" aria-label={`${r.rating} van de 5 sterren`}>
          {stars(r.rating)}
        </span>
      ),
    },
    {
      key: "text",
      label: "Review",
      render: (r) => (
        <div className="min-w-[240px] max-w-md">
          {r.title && <strong className="block">{r.title}</strong>}
          <span className="text-ink-soft">{clip(r.text, 160)}</span>
        </div>
      ),
    },
    {
      key: "product",
      label: "Product",
      render: (r) =>
        r.product ? (
          <Link href={`/admin/producten/${r.product.id}/bewerken/`} className="hover:underline">
            {r.product.name}
          </Link>
        ) : (
          <span className="text-ink-soft">Winkel</span>
        ),
    },
    { key: "date", label: "Datum", sortable: true, className: "whitespace-nowrap", render: (r) => fmtDate(r.date) },
    { key: "status", label: "Status", sortable: true, render: (r) => <Badge tone={REVIEW_STATUS[r.status]?.tone}>{REVIEW_STATUS[r.status]?.label ?? r.status}</Badge> },
    {
      key: "actions",
      label: "Acties",
      render: (r) => (
        <div className="flex flex-wrap gap-1.5">
          {r.status !== "approved" && <ActionForm action={setReviewStatus.bind(null, r.id, "approved")} label="Goedkeuren" />}
          {r.status !== "rejected" && <ActionForm action={setReviewStatus.bind(null, r.id, "rejected")} label="Afwijzen" />}
          <DeleteButton action={deleteReview.bind(null, r.id, false)} confirmText={`De review van ${r.name} definitief verwijderen? Dit kan niet ongedaan worden gemaakt.`} />
        </div>
      ),
    },
  ];
  return (
    <>
      <PageHeader
        title="Reviews"
        description={`${summary.count} goedgekeurde reviews, gemiddeld ${summary.average.toLocaleString("nl-NL", { minimumFractionDigits: 1 })} van de 5. ${pending ? `${pending} ${pending === 1 ? "review wacht" : "reviews wachten"} op beoordeling.` : "Er wachten geen reviews op beoordeling."}`}
      />
      {sp.verwijderd && <Notice>Review verwijderd.</Notice>}
      {pending > 0 && params.filters.status !== "pending" && (
        <p className="mb-4 text-sm">
          <Link href="/admin/reviews/?status=pending" className="font-medium underline">
            Toon de {pending} {pending === 1 ? "review die wacht" : "reviews die wachten"} op beoordeling
          </Link>
        </p>
      )}
      <ShopBulkBar
        formId="bulk-reviews"
        action={bulkReviews}
        allIds={total > rows.length ? all.map((a) => a.id) : []}
        options={[
          { value: "approve", label: "Goedkeuren" },
          { value: "reject", label: "Afwijzen", confirm: "{n} reviews afwijzen? Ze verdwijnen van de site." },
          { value: "delete", label: "Verwijderen", confirm: "{n} reviews definitief verwijderen? Dit kan niet ongedaan worden gemaakt." },
        ]}
      />
      <DataTable
        base="/admin/reviews/"
        params={params}
        columns={cols}
        rows={rows}
        total={total}
        searchLabel="Zoek op naam, tekst of product"
        selectForm="bulk-reviews"
        filters={[
          { name: "status", label: "Status", options: Object.entries(REVIEW_STATUS).map(([value, s]) => ({ value, label: s.label })) },
          { name: "score", label: "Score", options: [5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} ${n === 1 ? "ster" : "sterren"}` })) },
          { name: "geverifieerd", label: "Geverifieerd", options: [{ value: "ja", label: "Geverifieerde koper" }, { value: "nee", label: "Niet geverifieerd" }] },
        ]}
        newHref="/admin/reviews/nieuw/"
        newLabel="Review toevoegen"
      />
    </>
  );
}
