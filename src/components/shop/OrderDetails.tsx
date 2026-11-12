import type { Order, OrderItem } from "@prisma/client";
import Link from "next/link";
import { parse } from "@/lib/json";
import { money } from "@/lib/money";
import { LineImage } from "./CartTotals";
import { ORDER_STATUS, TONE_CLASS, addressLines, type OrderAddress } from "./order-status";

// Weergave van een bestelling (bedankpagina en account): regels, totalen en adressen. Alles komt uit de
// momentopname die bij de bestelling is bewaard, dus latere prijswijzigingen veranderen hier niets.

export function StatusBadge({ status }: { status: string }) {
  const s = ORDER_STATUS[status] ?? { label: status, tone: "neutral" as const };
  return <span className={`badge ${TONE_CLASS[s.tone]}`}>{s.label}</span>;
}

export const orderDate = (d: Date) => new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Amsterdam" }).format(d);

export function OrderDetails({ order }: { order: Order & { items: OrderItem[] } }) {
  const ship = parse<OrderAddress | null>(order.shippingAddress, null);
  const bill = parse<OrderAddress | null>(order.billingAddress, null);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <section className="card p-5 sm:p-6" aria-label="Bestelde artikelen">
        <h2 className="mb-4 text-xl">Je bestelling</h2>
        <ul className="divide-y divide-rule">
          {order.items.map((i) => (
            <li key={i.id} className="flex items-center gap-4 py-3 first:pt-0">
              <LineImage src={i.image} alt="" size={64} />
              <div className="min-w-0 flex-1 text-sm leading-snug">
                {i.path ? (
                  <Link href={i.path} className="font-semibold text-ink underline-offset-2 hover:text-brand hover:underline">
                    {i.name}
                  </Link>
                ) : (
                  <span className="font-semibold text-ink">{i.name}</span>
                )}
                {i.variantName && <span className="block text-muted">{i.variantName}</span>}
                <span className="block text-muted">
                  {i.quantity} × {money(i.unitPrice)}
                </span>
              </div>
              <span className="text-sm font-semibold tabular-nums text-ink">{money(i.total)}</span>
            </li>
          ))}
        </ul>
        <dl className="rule-top mt-2 space-y-2 pt-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt>Subtotaal</dt>
            <dd className="font-semibold tabular-nums text-ink">{money(order.subtotal)}</dd>
          </div>
          {order.discountCode && (
            <div className="flex justify-between gap-4 text-success">
              <dt>
                Korting <span className="font-semibold">{order.discountCode}</span>
              </dt>
              <dd className="font-semibold tabular-nums">{order.discountAmount ? `- ${money(order.discountAmount)}` : "Gratis verzending"}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt>Verzendkosten</dt>
            <dd className={`font-semibold tabular-nums ${order.shippingCost ? "text-ink" : "text-success"}`}>{order.shippingCost ? money(order.shippingCost) : "Gratis"}</dd>
          </div>
          <div className="rule-top flex items-baseline justify-between gap-4 pt-3">
            <dt className="text-base font-bold text-ink">Totaal</dt>
            <dd className="price text-2xl">{money(order.total)}</dd>
          </div>
          <div className="flex justify-between gap-4 text-xs text-muted">
            <dt>Inclusief btw</dt>
            <dd className="tabular-nums">{money(order.vatAmount)}</dd>
          </div>
          {order.refundedAmount > 0 && (
            <div className="flex justify-between gap-4">
              <dt>Terugbetaald</dt>
              <dd className="font-semibold tabular-nums text-ink">{money(order.refundedAmount)}</dd>
            </div>
          )}
        </dl>
      </section>

      <aside className="space-y-4">
        <div className="card p-5 text-sm leading-relaxed">
          <h2 className="mb-2 text-base">Bezorgadres</h2>
          <address className="not-italic text-ink-2">
            {addressLines(ship).map((l) => (
              <span key={l} className="block">
                {l}
              </span>
            ))}
          </address>
          <h2 className="mb-2 mt-5 text-base">Factuuradres</h2>
          <address className="not-italic text-ink-2">
            {addressLines(bill).map((l) => (
              <span key={l} className="block">
                {l}
              </span>
            ))}
          </address>
          <h2 className="mb-2 mt-5 text-base">Contact</h2>
          <p className="text-ink-2">
            {order.email}
            {order.phone && <span className="block">{order.phone}</span>}
          </p>
        </div>
        {(order.trackingCode || order.trackingUrl) && (
          <div className="card p-5 text-sm">
            <h2 className="mb-2 text-base">Track &amp; trace</h2>
            {order.trackingCode && <p className="font-semibold text-ink">{order.trackingCode}</p>}
            {order.trackingUrl && /^https?:\/\//i.test(order.trackingUrl) && (
              <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="link">
                Volg je pakket
              </a>
            )}
          </div>
        )}
        {order.note && (
          <div className="card p-5 text-sm">
            <h2 className="mb-2 text-base">Je opmerking</h2>
            <p className="whitespace-pre-line text-ink-2">{order.note}</p>
          </div>
        )}
      </aside>
    </div>
  );
}
