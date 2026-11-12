import Link from "next/link";
import type { Discount, Prisma } from "@prisma/client";
import { bulkDiscounts } from "@/app/admin/actions/shop";
import { DataTable, PER_PAGE, readParams, type Column } from "@/components/admin/DataTable";
import { ShopBulkBar } from "@/components/admin/shop/ShopBulkBar";
import { DISCOUNT_TYPES } from "@/components/admin/shop/format";
import { Badge, Notice, PageHeader, fmtDate } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/money";
import { like } from "@/lib/search";

export const metadata = { title: "Kortingscodes" };

const valueOf = (d: Discount) => (d.type === "percent" ? `${d.value}%` : d.type === "fixed" ? money(d.value) : "Gratis verzending");

/** Waarom een code nu wel of niet werkt. */
function state(d: Discount): { label: string; tone: "success" | "warning" | "neutral" | "danger" } {
  const now = new Date();
  if (!d.active) return { label: "Uitgeschakeld", tone: "neutral" };
  if (d.endsAt && d.endsAt < now) return { label: "Verlopen", tone: "danger" };
  if (d.usageLimit != null && d.used >= d.usageLimit) return { label: "Limiet bereikt", tone: "danger" };
  if (d.startsAt && d.startsAt > now) return { label: "Gepland", tone: "warning" };
  return { label: "Actief", tone: "success" };
}

export default async function DiscountsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireUser("user");
  const sp = await searchParams;
  const params = readParams(sp, { sort: "createdAt", dir: "desc" }, ["actief", "soort"]);
  const where: Prisma.DiscountWhereInput = {
    ...(params.q ? { code: like(params.q.toUpperCase()) } : {}),
    ...(params.filters.actief === "ja" ? { active: true } : params.filters.actief === "nee" ? { active: false } : {}),
    ...(params.filters.soort ? { type: params.filters.soort } : {}),
  };
  const sort = ["code", "type", "used", "endsAt", "createdAt", "active"].includes(params.sort) ? params.sort : "createdAt";
  const [rows, total, all] = await Promise.all([db.discount.findMany({ where, orderBy: [{ [sort]: params.dir }, { id: "asc" }], skip: (params.page - 1) * PER_PAGE, take: PER_PAGE }), db.discount.count({ where }), db.discount.findMany({ where, select: { id: true } })]);
  const cols: Column<Discount>[] = [
    {
      key: "code",
      label: "Code",
      sortable: true,
      render: (r) => (
        <Link href={`/admin/kortingscodes/${r.id}/bewerken/`} className="font-mono font-medium hover:underline">
          {r.code}
        </Link>
      ),
    },
    { key: "type", label: "Soort", sortable: true, render: (r) => DISCOUNT_TYPES[r.type] ?? r.type },
    { key: "value", label: "Waarde", className: "whitespace-nowrap", render: (r) => (r.type === "shipping" ? <span className="text-ink-soft">–</span> : valueOf(r)) },
    { key: "minOrder", label: "Minimaal orderbedrag", className: "whitespace-nowrap", render: (r) => (r.minOrder ? money(r.minOrder) : <span className="text-ink-soft">geen</span>) },
    { key: "limit", label: "Limiet", render: (r) => r.usageLimit ?? <span className="text-ink-soft">onbeperkt</span> },
    { key: "used", label: "Gebruikt", sortable: true, render: (r) => r.used },
    {
      key: "endsAt",
      label: "Looptijd",
      sortable: true,
      className: "whitespace-nowrap",
      render: (r) => (!r.startsAt && !r.endsAt ? <span className="text-ink-soft">altijd</span> : `${r.startsAt ? fmtDate(r.startsAt) : "nu"} – ${r.endsAt ? fmtDate(r.endsAt) : "geen einddatum"}`),
    },
    { key: "active", label: "Actief", sortable: true, render: (r) => <Badge tone={state(r).tone}>{state(r).label}</Badge> },
  ];
  return (
    <>
      <PageHeader title="Kortingscodes" description="Codes die klanten in de winkelwagen kunnen invullen: een percentage, een vast bedrag of gratis verzending." />
      {sp.verwijderd && <Notice>Kortingscode verwijderd.</Notice>}
      <ShopBulkBar
        formId="bulk-discounts"
        action={bulkDiscounts}
        allIds={total > rows.length ? all.map((a) => a.id) : []}
        options={[
          { value: "activate", label: "Activeren" },
          { value: "deactivate", label: "Deactiveren" },
          { value: "delete", label: "Verwijderen", confirm: "{n} kortingscodes definitief verwijderen? Dit kan niet ongedaan worden gemaakt." },
        ]}
      />
      <DataTable
        base="/admin/kortingscodes/"
        params={params}
        columns={cols}
        rows={rows}
        total={total}
        searchLabel="Zoek op code"
        selectForm="bulk-discounts"
        filters={[
          { name: "actief", label: "Actief", options: [{ value: "ja", label: "Ingeschakeld" }, { value: "nee", label: "Uitgeschakeld" }] },
          { name: "soort", label: "Soort", options: Object.entries(DISCOUNT_TYPES).map(([value, label]) => ({ value, label })) },
        ]}
        newHref="/admin/kortingscodes/nieuw/"
        newLabel="Nieuwe kortingscode"
      />
    </>
  );
}
