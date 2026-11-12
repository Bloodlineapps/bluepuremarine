import type { Metadata } from "next";
import Link from "next/link";
import { AccountShell } from "@/components/shop/AccountShell";
import { StatusBadge, orderDate } from "@/components/shop/OrderDetails";
import { addressLines } from "@/components/shop/order-status";
import { requireCustomer } from "@/lib/customer";
import { db } from "@/lib/db";
import { money } from "@/lib/money";

export const metadata: Metadata = { title: "Mijn account", robots: { index: false, follow: true } };

const MESSAGES: Record<string, string> = { wachtwoord: "Je nieuwe wachtwoord is opgeslagen. Je bent nu ingelogd." };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ melding?: string }> }) {
  const customer = await requireCustomer("/account/");
  const { melding } = await searchParams;
  const [orders, total, address] = await Promise.all([
    db.order.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: "desc" }, take: 3, select: { id: true, number: true, status: true, total: true, createdAt: true, _count: { select: { items: true } } } }),
    db.order.count({ where: { customerId: customer.id } }),
    db.address.findFirst({ where: { customerId: customer.id, type: "shipping" }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] }),
  ]);
  const notice = melding ? MESSAGES[melding] : "";

  return (
    <AccountShell active="overzicht" title={`Welkom, ${customer.firstName}`} intro="Hier vind je je bestellingen, adressen en gegevens.">
      {notice && (
        <p role="status" className="rounded-lg bg-success-100 px-4 py-3 text-sm font-medium text-success">
          {notice}
        </p>
      )}

      <section className="card p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl">Laatste bestellingen</h2>
          {total > 0 && (
            <Link href="/account/bestellingen/" className="link text-sm font-semibold">
              Alle bestellingen ({total})
            </Link>
          )}
        </div>
        {orders.length === 0 ? (
          <div className="text-sm text-ink-2">
            <p>Je hebt nog geen bestellingen geplaatst.</p>
            <Link href="/" className="btn-primary btn-sm mt-4">
              Naar de winkel
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-rule">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/account/bestellingen/?nr=${encodeURIComponent(o.number)}`} className="group flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 text-sm">
                  <span>
                    <span className="font-bold text-ink group-hover:text-brand">{o.number}</span>
                    <span className="ml-2 text-muted">
                      {orderDate(o.createdAt)} · {o._count.items} {o._count.items === 1 ? "artikel" : "artikelen"}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <StatusBadge status={o.status} />
                    <span className="font-semibold tabular-nums text-ink">{money(o.total)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card p-5 sm:p-6">
          <h2 className="mb-3 text-xl">Standaard bezorgadres</h2>
          {address ? (
            <address className="text-sm not-italic leading-relaxed text-ink-2">
              {addressLines(address).map((l) => (
                <span key={l} className="block">
                  {l}
                </span>
              ))}
            </address>
          ) : (
            <p className="text-sm text-ink-2">Je hebt nog geen adres opgeslagen.</p>
          )}
          <Link href="/account/adressen/" className="link mt-4 inline-block text-sm font-semibold">
            Adressen beheren
          </Link>
        </section>
        <section className="card p-5 sm:p-6">
          <h2 className="mb-3 text-xl">Mijn gegevens</h2>
          <p className="text-sm leading-relaxed text-ink-2">
            {customer.firstName} {customer.lastName}
            <span className="block">{customer.email}</span>
            {customer.phone && <span className="block">{customer.phone}</span>}
          </p>
          <Link href="/account/gegevens/" className="link mt-4 inline-block text-sm font-semibold">
            Gegevens of wachtwoord wijzigen
          </Link>
        </section>
      </div>
    </AccountShell>
  );
}
