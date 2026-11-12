import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountShell } from "@/components/shop/AccountShell";
import { OrderDetails, StatusBadge, orderDate } from "@/components/shop/OrderDetails";
import { PAYMENT_STATUS } from "@/components/shop/order-status";
import { requireCustomer } from "@/lib/customer";
import { db } from "@/lib/db";
import { money } from "@/lib/money";

export const metadata: Metadata = { title: "Mijn bestellingen", robots: { index: false, follow: true } };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ nr?: string }> }) {
  const { nr } = await searchParams;
  const customer = await requireCustomer(nr ? `/account/bestellingen/?nr=${encodeURIComponent(nr)}` : "/account/bestellingen/");

  if (nr) {
    // details van één bestelling: alleen als die bij deze klant hoort
    const order = await db.order.findFirst({ where: { number: nr.slice(0, 40), customerId: customer.id }, include: { items: true } });
    if (!order) notFound();
    const unpaid = !order.paidAt && order.status === "pending";
    return (
      <AccountShell active="bestellingen" title={`Bestelling ${order.number}`}>
        <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span>Geplaatst op {orderDate(order.createdAt)}</span>
            <StatusBadge status={order.status} />
            <span>Betaling: {PAYMENT_STATUS[order.paymentStatus]?.label ?? order.paymentStatus}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/account/bestellingen/" className="btn-secondary btn-sm">
              Alle bestellingen
            </Link>
            <Link href={`/bestelling/?t=${order.token}`} className={unpaid ? "btn-accent btn-sm" : "btn-secondary btn-sm"}>
              {unpaid ? "Betaling afronden" : "Statuspagina"}
            </Link>
          </div>
        </div>
        <OrderDetails order={order} />
      </AccountShell>
    );
  }

  const orders = await db.order.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, number: true, token: true, status: true, total: true, createdAt: true, paidAt: true, items: { select: { name: true, quantity: true }, take: 3 }, _count: { select: { items: true } } },
  });

  return (
    <AccountShell active="bestellingen" title="Mijn bestellingen" intro="Al je bestellingen op een rij, de nieuwste bovenaan.">
      {orders.length === 0 ? (
        <div className="card p-6 text-sm text-ink-2">
          <p>Je hebt nog geen bestellingen geplaatst.</p>
          <Link href="/" className="btn-primary btn-sm mt-4">
            Naar de winkel
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id} className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div>
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-ink">{o.number}</span>
                    <StatusBadge status={o.status} />
                  </p>
                  <p className="mt-0.5 text-sm text-muted">{orderDate(o.createdAt)}</p>
                </div>
                <p className="price text-lg">{money(o.total)}</p>
              </div>
              <p className="mt-3 text-sm text-ink-2">
                {o.items.map((i) => `${i.quantity} × ${i.name}`).join(", ")}
                {o._count.items > o.items.length ? ` en nog ${o._count.items - o.items.length} ${o._count.items - o.items.length === 1 ? "artikel" : "artikelen"}` : ""}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/account/bestellingen/?nr=${encodeURIComponent(o.number)}`} className="btn-secondary btn-sm">
                  Bekijk bestelling
                </Link>
                {!o.paidAt && o.status === "pending" && (
                  <Link href={`/bestelling/?t=${o.token}`} className="btn-accent btn-sm">
                    Betaling afronden
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </AccountShell>
  );
}
