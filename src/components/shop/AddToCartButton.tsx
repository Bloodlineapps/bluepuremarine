"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { addToCart } from "@/app/actions/shop";
import { CartIcon, announceCart } from "./CartIndicator";

// Knop "In winkelwagen" (productkaarten, productpagina). Voegt toe via een server action, toont kort een vinkje met
// "Toegevoegd" en laat de header weten dat de wagen is veranderd.

export type AddToCartButtonProps = {
  productId: string;
  variantId?: string | null;
  quantity?: number;
  disabled?: boolean;
  label?: string;
  className?: string;
  /** alleen een icoon (voor productkaarten) */
  compact?: boolean;
  /** wordt aangeroepen na een geslaagde toevoeging */
  onAdded?: () => void;
};

const Check = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 animate-pop" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5 10 17l9-10" />
  </svg>
);

export function AddToCartButton({ productId, variantId = null, quantity = 1, disabled = false, label = "In winkelwagen", className, compact = false, onAdded }: AddToCartButtonProps) {
  const [pending, start] = useTransition();
  const [added, setAdded] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const flash = (fn: () => void, ms: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(fn, ms);
  };

  const add = () => {
    if (disabled || pending) return;
    setError("");
    // optimistisch: het vinkje verschijnt meteen
    setAdded(true);
    start(async () => {
      try {
        const res = await addToCart(productId, variantId, quantity);
        announceCart({ count: res.count, total: res.total });
        if (res.ok) {
          onAdded?.();
          if (res.message) setError(res.message);
          flash(() => {
            setAdded(false);
            setError("");
          }, res.message ? 4000 : 1800);
        } else {
          setAdded(false);
          setError(res.message ?? "Toevoegen is niet gelukt.");
          flash(() => setError(""), 5000);
        }
      } catch {
        setAdded(false);
        setError("Toevoegen is niet gelukt. Probeer het opnieuw.");
        flash(() => setError(""), 5000);
      }
    });
  };

  const text = added ? "Toegevoegd" : label;
  return (
    <span className={`relative inline-flex ${compact ? "" : "max-w-full"}`}>
      <button
        type="button"
        onClick={add}
        disabled={disabled}
        aria-busy={pending}
        aria-label={compact ? text : undefined}
        title={compact ? text : undefined}
        className={className ?? (compact ? "btn-accent h-11 min-h-11 w-11 !px-0" : "btn-accent")}
      >
        {added ? <Check /> : <CartIcon className="h-5 w-5" />}
        {!compact && <span>{text}</span>}
      </button>
      <span role="status" aria-live="polite" className={error ? "absolute right-0 top-full z-20 mt-1.5 w-56 rounded-lg bg-navy px-3 py-2 text-left text-xs font-medium leading-snug text-white shadow-lg" : "sr-only"}>
        {error || (added ? "Toegevoegd aan je winkelwagen" : "")}
      </span>
    </span>
  );
}
