import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderDetails, StatusBadge, orderDate } from "@/components/shop/OrderDetails";
import { OrderDone } from "@/components/shop/OrderDone";
import { db } from "@/lib/db";
import { money } from "@/lib/money";
import { paymentMode } from "@/lib/mollie";
import { syncMolliePayment } from "@/lib/orders";
import { getShop, getSite } from "@/lib/settings";
import { retryPayment } from "../afrekenen/actions";

export const metadata: Metadata = { title: "Je bestelling", robots: { index: false, follow: true } };

const ERRORS: Record<string, string> = {
  betaling: "De betaling kon niet worden gestart. Je bestelling is bewaard; probeer het opnieuw.",
  voorraad: "Een of meer artikelen uit deze bestelling zijn niet meer op voorraad. Neem contact met ons op of plaats een nieuwe bestelling.",
  druk: "Te veel pogingen achter elkaar. Probeer het over een paar minuten opnieuw.",
};

const Tick = () => (
  <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-success-100 text-success">
    <svg viewBox="0 0 24 24" className="h-8 w-8 animate-pop" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5 10 17l9-10" />
    </svg>
  </span>
);

export default async function OrderPage({ searchParams }: { searchParams: Promise<{ t?: string; fout?: string }> }) {
  const { t = "", fout } = await searchParams;
  if (!/^[A-Za-z0-9_-]{32,64}$/.test(t)) notFound();
  let order = await db.order.findUnique({ where: { token: t }, include: { items: true } });
  if (!order) notFound();

  // Mollie-betaling die nog open staat: eerst de actuele status ophalen (lokaal komt er geen webhook binnen)
  if (order.paymentProvider === "mollie" && order.paymentId && !order.paidAt && order.status === "pending" && order.paymentStatus === "open") {
    await syncMolliePayment(order.paymentId);
    order = (await db.order.findUnique({ where: { token: t }, include: { items: true } })) ?? order;
  }

  const [shop, site, mode] = await Promise.all([getShop(), getSite(), paymentMode()]);
  const paid = !!order.paidAt && order.status !== "cancelled" && order.status !== "refunded";
  const transfer = !order.paidAt && order.status === "pending" && order.paymentProvider === "overboeking";
  const waiting = !order.paidAt && order.status === "pending" && !transfer && order.paymentStatus === "open";
  const failed = !order.paidAt && order.status === "pending" && !transfer && !waiting;
  // De betaling is bij Mollie nooit gestart (storing bij het aanmaken): dan valt er ook niets af te wachten
  const notStarted = waiting && order.paymentProvider === "mollie" && !order.paymentId;
  const error = fout && !paid ? ERRORS[fout] : "";
  const iban = shop.iban.trim();
  const token = order.token;
  const failText: Record<string, string> = { failed: "De betaling is mislukt.", expired: "De betaling is verlopen.", canceled: "Je hebt de betaling geannuleerd." };

  const retry = (label: string, primary = true) => (
    <form action={retryPayment} className="mt-5">
      <input type="hidden" name="t" value={token} />
      <button type="submit" className={primary ? "btn-accent btn-lg" : "btn-primary"}>
        {label}
      </button>
    </form>
  );

  return (
    <div className="container-x py-8 md:py-12">
      {(paid || transfer) && <OrderDone token={order.token} />}

      {error && (
        <p role="alert" className="mb-5 rounded-lg border border-coral bg-coral-100 px-4 py-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}

      <div className="card p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <span>
            Bestelnummer <strong className="text-ink">{order.number}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>{orderDate(order.createdAt)}</span>
          <StatusBadge status={order.status} />
        </div>

        {paid && (
          <div className="mt-4 flex items-start gap-4">
            <Tick />
            <div>
              <h1 className="text-2xl md:text-3xl">{order.status === "shipped" ? "Je bestelling is onderweg" : order.status === "completed" ? "Je bestelling is afgerond" : "Bedankt voor je bestelling"}</h1>
              <p className="mt-2 max-w-2xl text-ink-2">
                {order.status === "paid" ? (
                  <>
                    Je betaling is ontvangen. We hebben een bevestiging gestuurd naar <strong>{order.email}</strong> en gaan met je bestelling aan de slag.
                  </>
                ) : order.status === "shipped" ? (
                  "Je pakket is verzonden. De track & trace vind je hieronder, als die beschikbaar is."
                ) : (
                  "Veel plezier met je aankoop."
                )}
              </p>
            </div>
          </div>
        )}

        {transfer && (
          <div className="mt-4">
            <div className="flex items-start gap-4">
              <Tick />
              <div>
                <h1 className="text-2xl md:text-3xl">Bedankt voor je bestelling</h1>
                <p className="mt-2 max-w-2xl text-ink-2">
                  We hebben je bestelling ontvangen en een bevestiging gestuurd naar <strong>{order.email}</strong>.
                </p>
              </div>
            </div>
            {iban ? (
              <div className="mt-5 rounded-lg bg-brand-50 p-5">
                <h2 className="text-lg">Betalen per overboeking</h2>
                <p className="mt-1 text-sm text-ink-2">Maak het bedrag over met de gegevens hieronder. Zodra je betaling binnen is, maken we je bestelling klaar voor verzending.</p>
                <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted">Bedrag</dt>
                    <dd className="price text-lg">{money(order.total)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Rekeningnummer (IBAN)</dt>
                    <dd className="font-bold text-ink">{iban}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Ten name van</dt>
                    <dd className="font-bold text-ink">{site.legalName || site.name}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Omschrijving</dt>
                    <dd className="font-bold text-ink">{order.number}</dd>
                  </div>
                </dl>
              </div>
            ) : (
              <p className="mt-5 rounded-lg bg-brand-50 p-5 text-sm text-ink">We nemen contact met je op over de betaling van je bestelling.</p>
            )}
            {mode !== "overboeking" && retry("Nu online betalen", false)}
          </div>
        )}

        {waiting && (
          <div className="mt-4">
            <h1 className="text-2xl md:text-3xl">{notStarted ? "Je bestelling is nog niet betaald" : "We wachten op je betaling"}</h1>
            <p className="mt-2 max-w-2xl text-ink-2">
              {notStarted
                ? "Je bestelling is bewaard, maar het betalen is nog niet gelukt. Er is niets afgeschreven. Start de betaling opnieuw om je bestelling af te ronden."
                : "Je bestelling is geplaatst, maar we hebben de betaling nog niet ontvangen. Heb je net betaald? Dan kan het even duren voordat de bevestiging binnen is; ververs deze pagina over een minuut."}
            </p>
            {retry(notStarted ? "Nu betalen" : "Opnieuw betalen")}
          </div>
        )}

        {failed && (
          <div className="mt-4">
            <h1 className="text-2xl md:text-3xl">De betaling is niet gelukt</h1>
            <p className="mt-2 max-w-2xl text-ink-2">{failText[order.paymentStatus] ?? "De betaling is niet afgerond."} Er is niets afgeschreven. Je bestelling staat nog voor je klaar: je kunt de betaling opnieuw proberen.</p>
            {retry("Opnieuw proberen")}
          </div>
        )}

        {order.status === "cancelled" && (
          <div className="mt-4">
            <h1 className="text-2xl md:text-3xl">Deze bestelling is geannuleerd</h1>
            <p className="mt-2 max-w-2xl text-ink-2">Heb je hier een vraag over? Neem dan contact met ons op en vermeld je bestelnummer.</p>
          </div>
        )}

        {order.status === "refunded" && (
          <div className="mt-4">
            <h1 className="text-2xl md:text-3xl">Deze bestelling is terugbetaald</h1>
            <p className="mt-2 max-w-2xl text-ink-2">Het bedrag van {money(order.refundedAmount)} is aan je terugbetaald.</p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/" className="btn-secondary">
            Verder winkelen
          </Link>
          <Link href="/contact/" className="btn-ghost">
            Vraag over je bestelling?
          </Link>
        </div>
      </div>

      <div className="mt-6">
        <OrderDetails order={order} />
      </div>
    </div>
  );
}
