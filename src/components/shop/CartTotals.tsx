import Image from "next/image";
import type { Cart } from "@/lib/cart";
import { money } from "@/lib/money";

// Overzicht van de winkelwagen (server component): subtotaal, korting, verzendkosten, totaal en btw. Gebruikt op de
// winkelwagen- en de afrekenpagina.

export function CartTotals({ cart }: { cart: Cart }) {
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between gap-4">
        <dt>Subtotaal</dt>
        <dd className="font-semibold tabular-nums text-ink">{money(cart.subtotal)}</dd>
      </div>
      {cart.discount && (
        <div className="flex justify-between gap-4 text-success">
          <dt>
            Korting <span className="font-semibold">{cart.discount.code}</span>
          </dt>
          <dd className="font-semibold tabular-nums">{cart.discount.amount ? `- ${money(cart.discount.amount)}` : cart.discount.label}</dd>
        </div>
      )}
      <div className="flex justify-between gap-4">
        <dt>Verzendkosten</dt>
        <dd className={`font-semibold tabular-nums ${cart.shipping ? "text-ink" : "text-success"}`}>{cart.shipping ? money(cart.shipping) : "Gratis"}</dd>
      </div>
      <div className="rule-top flex items-baseline justify-between gap-4 pt-3">
        <dt className="text-base font-bold text-ink">Totaal</dt>
        <dd className="price text-2xl">{money(cart.total)}</dd>
      </div>
      <div className="flex justify-between gap-4 text-xs text-muted">
        <dt>Inclusief btw</dt>
        <dd className="tabular-nums">{money(cart.vat)}</dd>
      </div>
    </dl>
  );
}

/** Voortgang naar gratis verzending: "Nog € x tot gratis verzending" met balk. */
export function FreeShippingBar({ cart }: { cart: Cart }) {
  if (!cart.lines.length || cart.freeShippingFrom <= 0) return null;
  const left = cart.freeShippingLeft;
  const pct = left > 0 ? Math.max(4, Math.min(100, Math.round(((cart.freeShippingFrom - left) / cart.freeShippingFrom) * 100))) : 100;
  if (left <= 0 && cart.shipping > 0) return null;
  return (
    <div className="rounded-lg bg-brand-50 p-3.5">
      <p className="text-sm font-semibold text-ink">{left > 0 ? <>Nog {money(left)} tot gratis verzending</> : "Je bestelling wordt gratis verzonden"}</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Voortgang naar gratis verzending">
        <div className={`h-full rounded-full transition-[width] duration-500 ${left > 0 ? "bg-brand" : "bg-success"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Kleine productafbeelding met nette lege staat. */
export function LineImage({ src, alt, size = 80 }: { src: string; alt: string; size?: number }) {
  return (
    <span className="relative block shrink-0 overflow-hidden rounded-lg border border-rule bg-white" style={{ width: size, height: size }}>
      {src ? <Image src={src} alt={alt} fill sizes={`${size}px`} className="object-contain p-1" /> : <span className="absolute inset-0 bg-paper-2" aria-hidden="true" />}
    </span>
  );
}

/** Compacte regels van de wagen voor het orderoverzicht bij het afrekenen. */
export function CartLinesCompact({ cart }: { cart: Cart }) {
  return (
    <ul className="divide-y divide-rule">
      {cart.lines
        .filter((l) => l.inStock)
        .map((l) => (
          <li key={l.key} className="flex items-center gap-3 py-3 first:pt-0">
            <span className="relative">
              <LineImage src={l.image} alt="" size={56} />
              <span className="absolute -right-2 -top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-navy px-1 text-[0.7rem] font-bold text-white" aria-label={`Aantal: ${l.quantity}`}>
                {l.quantity}
              </span>
            </span>
            <span className="min-w-0 flex-1 text-sm leading-snug">
              <span className="block font-semibold text-ink">{l.name}</span>
              {l.variantName && <span className="block text-muted">{l.variantName}</span>}
            </span>
            <span className="text-sm font-semibold tabular-nums text-ink">{money(l.lineTotal)}</span>
          </li>
        ))}
    </ul>
  );
}
