import type { Metadata } from "next";
import Link from "next/link";
import { removeCartLineForm, removeDiscountForm, setShippingCountryForm, updateCartLineForm } from "@/app/actions/shop";
import { AutoSubmitSelect, CartSync, DiscountForm } from "@/components/shop/CartParts";
import { CartTotals, FreeShippingBar, LineImage } from "@/components/shop/CartTotals";
import { computeCart, readCartState } from "@/lib/cart";
import { money } from "@/lib/money";
import { categoryTree } from "@/lib/shop";

export const metadata: Metadata = { title: "Winkelwagen", robots: { index: false, follow: true } };

const MESSAGES: Record<string, string> = {
  voorraad: "De voorraad is veranderd terwijl je aan het afrekenen was. Controleer je winkelwagen en ga daarna verder.",
  leeg: "Je winkelwagen is leeg. Voeg eerst een product toe.",
  toevoegen: "Het product kon niet worden toegevoegd: het is uitverkocht of niet meer verkrijgbaar.",
};

const stepBtn = "inline-flex h-11 w-11 items-center justify-center text-xl font-bold text-ink transition-colors hover:bg-brand-50 hover:text-brand disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-ink";

export default async function CartPage({ searchParams }: { searchParams: Promise<{ melding?: string }> }) {
  const { melding } = await searchParams;
  const state = await readCartState();
  const { cart, state: clean } = await computeCart(state);
  const stale = JSON.stringify(clean) !== JSON.stringify(state);
  const notice = melding ? (MESSAGES[melding] ?? "") : "";

  if (!cart.lines.length) {
    const categories = await categoryTree();
    return (
      <div className="container-x py-10 md:py-14">
        <CartSync count={0} total={0} sync={stale} />
        <h1 className="text-3xl md:text-4xl">Winkelwagen</h1>
        {(notice || cart.notices.length > 0) && (
          <div className="mt-5 rounded-lg bg-sun-100 px-4 py-3 text-sm font-medium text-ink" role="status">
            {[notice, ...cart.notices].filter(Boolean).map((n) => (
              <p key={n}>{n}</p>
            ))}
          </div>
        )}
        <div className="card mt-6 p-8 text-center md:p-12">
          <p className="text-xl font-bold text-ink">Je winkelwagen is nog leeg</p>
          <p className="mx-auto mt-2 max-w-md text-muted">Kijk rond in ons assortiment en voeg toe wat je nodig hebt voor je boot.</p>
          {categories.length > 0 && (
            <ul className="mx-auto mt-6 flex max-w-2xl flex-wrap justify-center gap-2.5">
              {categories.map((c) => (
                <li key={c.id}>
                  <Link href={c.path} className="btn-secondary btn-sm">
                    {c.navTitle}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href="/" className="btn-primary mt-7">
            Verder winkelen
          </Link>
        </div>
      </div>
    );
  }

  const blocked = cart.lines.some((l) => !l.inStock);
  return (
    <div className="container-x py-8 md:py-12">
      <CartSync count={cart.count} total={cart.total} sync={stale} />
      <h1 className="text-3xl md:text-4xl">Winkelwagen</h1>
      <p className="mt-1 text-muted">
        {cart.count} {cart.count === 1 ? "artikel" : "artikelen"}
      </p>

      {(notice || cart.notices.length > 0) && (
        <div className="mt-5 space-y-1 rounded-lg bg-sun-100 px-4 py-3 text-sm font-medium text-ink" role="status">
          {[notice, ...cart.notices].filter(Boolean).map((n) => (
            <p key={n}>{n}</p>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start lg:gap-8">
        <section aria-label="Artikelen in je winkelwagen" className="card">
          <ul className="divide-y divide-rule">
            {cart.lines.map((l) => (
              <li key={l.key} className="flex gap-4 p-4 sm:p-5">
                <Link href={l.path} className="shrink-0" aria-hidden="true" tabIndex={-1}>
                  <LineImage src={l.image} alt="" size={88} />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <Link href={l.path} className="font-bold leading-snug text-ink underline-offset-2 hover:text-brand hover:underline">
                      {l.name}
                    </Link>
                    {l.variantName && <p className="text-sm text-muted">{l.variantName}</p>}
                    <p className="mt-1 text-sm text-muted">
                      {money(l.unitPrice)} per stuk
                      {l.compareAtPrice && l.compareAtPrice > l.unitPrice ? <span className="price-old ml-2">{money(l.compareAtPrice)}</span> : null}
                    </p>
                    {!l.inStock && <span className="badge-out mt-2">Uitverkocht</span>}
                  </div>
                  <div className="flex shrink-0 items-center gap-3 sm:gap-5">
                    {l.inStock && (
                      <form action={updateCartLineForm} className="inline-flex items-center overflow-hidden rounded-lg border-[1.5px] border-rule bg-white">
                        <input type="hidden" name="key" value={l.key} />
                        <button type="submit" name="quantity" value={l.quantity - 1} className={stepBtn} disabled={l.quantity <= 1} aria-label={`Eén minder van ${l.name}`}>
                          −
                        </button>
                        <span className="inline-flex h-11 min-w-11 items-center justify-center border-x-[1.5px] border-rule px-2 text-base font-bold tabular-nums text-ink" aria-label={`Aantal: ${l.quantity}`}>
                          {l.quantity}
                        </span>
                        <button type="submit" name="quantity" value={l.quantity + 1} className={stepBtn} disabled={l.quantity >= l.maxQuantity} aria-label={`Eén meer van ${l.name}`} title={l.quantity >= l.maxQuantity ? "Meer is er niet op voorraad" : undefined}>
                          +
                        </button>
                      </form>
                    )}
                    <span className="price min-w-20 text-right text-lg">{l.inStock ? money(l.lineTotal) : ""}</span>
                    <form action={removeCartLineForm}>
                      <input type="hidden" name="key" value={l.key} />
                      <button type="submit" className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-coral-100 hover:text-danger" aria-label={`Verwijder ${l.name}`} title="Verwijderen">
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-13M9 7V4h6v3" />
                        </svg>
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <aside className="card space-y-5 p-5 lg:sticky lg:top-28" aria-label="Overzicht">
          <h2 className="text-xl">Overzicht</h2>
          <FreeShippingBar cart={cart} />

          {cart.countries.length > 1 && (
            <form action={setShippingCountryForm}>
              <label htmlFor="verzendland" className="label">
                Verzenden naar
              </label>
              <div className="flex gap-2">
                <AutoSubmitSelect id="verzendland" name="country" defaultValue={cart.shippingCountry} options={cart.countries.map((c) => ({ value: c.country, label: c.label }))} />
                <noscript>
                  <button type="submit" className="btn-secondary">
                    Kies
                  </button>
                </noscript>
              </div>
            </form>
          )}

          {cart.discount ? (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-success-100 px-3.5 py-2.5 text-sm">
              <span className="text-success">
                Code <strong>{cart.discount.code}</strong>: {cart.discount.label}
              </span>
              <form action={removeDiscountForm}>
                <button type="submit" className="link text-sm">
                  Verwijderen
                </button>
              </form>
            </div>
          ) : (
            <div>
              <DiscountForm />
              {cart.discountNote && (
                <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted">
                  <span>{cart.discountNote}</span>
                  <form action={removeDiscountForm}>
                    <button type="submit" className="link text-sm">
                      Code verwijderen
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          <CartTotals cart={cart} />

          {blocked ? (
            <p className="rounded-lg bg-coral-100 px-3.5 py-2.5 text-sm font-medium text-danger">Verwijder eerst de uitverkochte artikelen om af te rekenen.</p>
          ) : (
            <Link href="/afrekenen/" className="btn-accent btn-lg w-full">
              Verder naar afrekenen
            </Link>
          )}
          <Link href="/" className="btn-ghost w-full">
            Verder winkelen
          </Link>
        </aside>
      </div>
    </div>
  );
}
