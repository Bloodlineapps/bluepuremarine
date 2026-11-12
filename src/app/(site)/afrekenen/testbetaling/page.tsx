import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { money } from "@/lib/money";
import { simulationEnabled } from "@/lib/mollie";
import { simulatePayment } from "../actions";

export const metadata: Metadata = { title: "Testbetaling", robots: { index: false, follow: true } };

// Gesimuleerde betaalpagina voor lokaal testen. Bestaat alleen als "betalingen simuleren" aan staat bij de
// connecties (en Mollie zelf niet actief is); anders geeft deze pagina een 404.
export default async function TestPaymentPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t = "" } = await searchParams;
  if (!(await simulationEnabled()) || !/^[A-Za-z0-9_-]{32,64}$/.test(t)) notFound();
  const order = await db.order.findUnique({ where: { token: t }, select: { number: true, total: true, token: true, paidAt: true, status: true, paymentProvider: true } });
  if (!order || order.paymentProvider !== "simulatie") notFound();
  if (order.paidAt || order.status !== "pending") redirect(`/bestelling/?t=${order.token}`);

  const outcomes = [
    { value: "paid", label: "Betaling geslaagd", className: "btn-primary" },
    { value: "failed", label: "Betaling mislukt", className: "btn-secondary" },
    { value: "canceled", label: "Geannuleerd", className: "btn-secondary" },
  ];
  return (
    <div className="container-x py-10 md:py-16">
      <div className="mx-auto max-w-xl overflow-hidden rounded-[var(--radius-card)] border-2 border-dashed border-sun bg-white shadow-[var(--shadow-card)]">
        <p className="bg-sun px-5 py-2.5 text-center text-sm font-extrabold uppercase tracking-widest text-navy">Testomgeving · geen echte betaling</p>
        <div className="p-6 sm:p-8">
          <h1 className="text-2xl md:text-3xl">Testbetaling</h1>
          <p className="mt-2 text-ink-2">Dit is een gesimuleerde betaalpagina. Er wordt niets afgeschreven. Kies hoe de betaling afloopt; de bestelling wordt daarna verwerkt zoals bij een echte betaling.</p>
          <dl className="mt-5 grid grid-cols-2 gap-3 rounded-lg bg-paper p-4 text-sm">
            <div>
              <dt className="text-muted">Bestelnummer</dt>
              <dd className="font-bold text-ink">{order.number}</dd>
            </div>
            <div>
              <dt className="text-muted">Bedrag</dt>
              <dd className="price text-lg">{money(order.total)}</dd>
            </div>
          </dl>
          <form action={simulatePayment} className="mt-6 grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="t" value={order.token} />
            {outcomes.map((o) => (
              <button key={o.value} type="submit" name="outcome" value={o.value} className={`${o.className} w-full !px-3`}>
                {o.label}
              </button>
            ))}
          </form>
        </div>
      </div>
    </div>
  );
}
