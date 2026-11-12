"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getCartSummary } from "@/app/actions/shop";
import { money } from "@/lib/money";

// Winkelwagen in de header: icoon met aantal-bolletje, "Mijn winkelwagen" en het totaal. Werkt bij via het
// window-event `cart:changed` (detail: { count, total }) en haalt bij het laden de actuele stand op.

export type CartChange = { count: number; total: number };

/** Laat de header (en andere luisteraars) weten dat de winkelwagen is veranderd. */
export function announceCart(detail: CartChange) {
  window.dispatchEvent(new CustomEvent<CartChange>("cart:changed", { detail }));
}

const readCount = () => {
  const m = /(?:^|;\s*)bpm_cart_n=(\d+)/.exec(document.cookie);
  return m ? Number(m[1]) : 0;
};

export function CartIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 3.5h2.6l2.3 11.2a1.5 1.5 0 0 0 1.5 1.2h8.7a1.5 1.5 0 0 0 1.5-1.2L20.5 7H6" />
      <circle cx="9.5" cy="19.5" r="1.4" />
      <circle cx="17.5" cy="19.5" r="1.4" />
    </svg>
  );
}

export function CartIndicator() {
  const [cart, setCart] = useState<CartChange | null>(null);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    let alive = true;
    // Het aantal staat in een leesbare cookie: direct tonen, het totaal volgt van de server
    const n = readCount();
    if (n > 0) {
      setCart((c) => c ?? { count: n, total: -1 });
      getCartSummary()
        .then((s) => alive && setCart((c) => (c && c.total >= 0 ? c : { count: s.count, total: s.total })))
        .catch(() => {});
    } else setCart((c) => c ?? { count: 0, total: 0 });
    const onChange = (e: Event) => {
      const d = (e as CustomEvent<CartChange>).detail;
      if (!d || typeof d.count !== "number") return;
      setCart({ count: d.count, total: d.total });
      setBump((b) => b + 1);
    };
    window.addEventListener("cart:changed", onChange);
    return () => {
      alive = false;
      window.removeEventListener("cart:changed", onChange);
    };
  }, []);

  const count = cart?.count ?? 0;
  const label = count === 0 ? "Mijn winkelwagen, leeg" : `Mijn winkelwagen, ${count} ${count === 1 ? "artikel" : "artikelen"}`;
  return (
    <Link href="/winkelwagen/" aria-label={label} className="group inline-flex min-h-11 items-center gap-2.5 rounded-lg px-1.5 py-1 text-current transition-colors hover:text-brand">
      <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand transition-colors group-hover:bg-brand group-hover:text-white">
        <CartIcon />
        {count > 0 && (
          <span key={bump} className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 animate-pop items-center justify-center rounded-full bg-coral px-1 text-[0.7rem] font-bold leading-none text-white ring-2 ring-white" aria-hidden="true">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </span>
      <span className="hidden text-left leading-tight sm:block" aria-hidden="true">
        <span className="block text-xs font-medium opacity-80">Mijn winkelwagen</span>
        <span className="block text-sm font-bold tabular-nums">{cart && cart.total >= 0 ? money(cart.total) : " "}</span>
      </span>
    </Link>
  );
}
