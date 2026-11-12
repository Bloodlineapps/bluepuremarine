"use client";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { addToCart, addToCartForm } from "@/app/actions/shop";
import { discountPct, money } from "@/lib/money";
import { CartIcon, announceCart } from "./CartIndicator";

// Koopblok op de productpagina: keuze per optie (maat, kleur …), prijs met van-prijs en kortingslabel, aantalkiezer
// en de knop "In winkelwagen". Zonder JavaScript werkt het als gewoon formulier (eerste leverbare variant).

export type BuyVariant = { id: string; name: string; options: string[]; price: number; compareAtPrice: number | null; stock: number };
export type ProductBuyFormProps = {
  productId: string;
  price: number;
  compareAtPrice: number | null;
  inStock: boolean;
  stock: number;
  trackStock: boolean;
  optionNames: string[];
  variants: BuyVariant[];
};

const MAX = 99;

export function ProductBuyForm({ productId, price, compareAtPrice, inStock, stock, trackStock, optionNames, variants }: ProductBuyFormProps) {
  const hasVariants = variants.length > 0;
  const available = (v: BuyVariant) => !trackStock || v.stock > 0;
  // namen van de opties; ontbreken ze, dan één keuzelijst "Uitvoering" op variantnaam
  const structured = useMemo(() => hasVariants && optionNames.length > 0 && variants.every((v) => v.options.length >= optionNames.length), [hasVariants, optionNames, variants]);
  const names = structured ? optionNames : hasVariants ? ["Uitvoering"] : [];
  const byName = hasVariants && !structured;
  const valuesOf = (v: BuyVariant) => (byName ? [v.name] : v.options.slice(0, names.length));

  const first = variants.find(available) ?? variants[0];
  const [choice, setChoice] = useState<string[]>(first ? valuesOf(first) : []);
  const [quantity, setQuantity] = useState(1);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const variant = hasVariants ? (variants.find((v) => valuesOf(v).every((val, i) => val === choice[i])) ?? null) : null;
  const curPrice = variant ? variant.price : price;
  const curCompare = variant ? variant.compareAtPrice : hasVariants ? null : compareAtPrice;
  const curStock = variant ? variant.stock : stock;
  const canBuy = hasVariants ? !!variant && available(variant) : inStock;
  const max = canBuy ? (trackStock ? Math.max(1, Math.min(MAX, curStock)) : MAX) : 1;
  const qty = Math.min(quantity, max);
  const pct = discountPct(curPrice, curCompare);

  const optionValues = (i: number) => [...new Set(variants.map((v) => valuesOf(v)[i]).filter((x) => x != null && x !== ""))];
  /** Is deze waarde te kiezen in combinatie met de andere gekozen opties? */
  const valueAvailable = (i: number, value: string) => variants.some((v) => available(v) && valuesOf(v).every((val, j) => (j === i ? val === value : choice[j] == null || val === choice[j])));

  const pick = (i: number, value: string) => {
    setStatus(null);
    setChoice((prev) => {
      const next = [...prev];
      next[i] = value;
      // bestaat deze combinatie niet, spring dan naar de eerste (leverbare) variant met de gekozen waarde
      if (!variants.some((v) => valuesOf(v).every((val, j) => val === next[j]))) {
        const alt = variants.find((v) => valuesOf(v)[i] === value && available(v)) ?? variants.find((v) => valuesOf(v)[i] === value);
        if (alt) return valuesOf(alt);
      }
      return next;
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canBuy || pending) return;
    setStatus(null);
    start(async () => {
      try {
        const res = await addToCart(productId, variant?.id ?? null, qty);
        announceCart({ count: res.count, total: res.total });
        setStatus(res.ok ? { ok: true, text: res.message ?? (qty === 1 ? "Toegevoegd aan je winkelwagen." : `${qty} stuks toegevoegd aan je winkelwagen.`) } : { ok: false, text: res.message ?? "Toevoegen is niet gelukt." });
      } catch {
        setStatus({ ok: false, text: "Toevoegen is niet gelukt. Probeer het opnieuw." });
      }
    });
  };

  const stepBtn = "inline-flex h-12 w-12 items-center justify-center text-xl font-bold text-ink transition-colors hover:bg-brand-50 hover:text-brand disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-ink";

  return (
    <form action={addToCartForm} onSubmit={submit} className="space-y-5">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="variantId" value={variant?.id ?? ""} />

      <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
        <span className="price text-4xl leading-none">{money(curPrice)}</span>
        {pct > 0 && curCompare != null && (
          <>
            <span className="price-old text-lg">
              <span className="sr-only">Van </span>
              {money(curCompare)}
            </span>
            <span className="badge-sale">-{pct}%</span>
          </>
        )}
        <span className="w-full text-xs text-muted">Inclusief btw</span>
      </div>

      {names.map((name, i) => {
        const values = optionValues(i);
        const asButtons = values.length <= 6 && values.every((v) => v.length <= 18);
        return (
          <fieldset key={name}>
            <legend className="label">
              {name}
              {choice[i] ? <span className="font-normal text-muted">: {choice[i]}</span> : null}
            </legend>
            {asButtons ? (
              <div className="flex flex-wrap gap-2">
                {values.map((value) => {
                  const selected = choice[i] === value;
                  const ok = valueAvailable(i, value);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => pick(i, value)}
                      aria-pressed={selected}
                      title={ok ? undefined : "Niet leverbaar"}
                      className={`inline-flex min-h-11 items-center rounded-lg border-2 px-4 py-2 text-sm font-semibold transition-colors ${selected ? "border-brand bg-brand-50 text-brand-700" : "border-rule bg-white text-ink hover:border-brand"} ${ok ? "" : "border-dashed text-muted line-through opacity-60"}`}
                    >
                      {value}
                      {!ok && <span className="sr-only"> (niet leverbaar)</span>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <select className="field" value={choice[i] ?? ""} onChange={(e) => pick(i, e.target.value)} aria-label={name}>
                {values.map((value) => (
                  <option key={value} value={value}>
                    {value}
                    {valueAvailable(i, value) ? "" : " (niet leverbaar)"}
                  </option>
                ))}
              </select>
            )}
          </fieldset>
        );
      })}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor={`aantal-${productId}`} className="label">
            Aantal
          </label>
          <div className="inline-flex items-center overflow-hidden rounded-lg border-[1.5px] border-rule bg-white">
            <button type="button" className={stepBtn} onClick={() => setQuantity(Math.max(1, qty - 1))} disabled={!canBuy || qty <= 1} aria-label="Eén minder">
              −
            </button>
            <input
              id={`aantal-${productId}`}
              name="quantity"
              type="number"
              inputMode="numeric"
              min={1}
              max={max}
              value={qty}
              disabled={!canBuy}
              onChange={(e) => setQuantity(Math.max(1, Math.min(max, Math.floor(Number(e.target.value)) || 1)))}
              className="h-12 w-14 border-x-[1.5px] border-rule bg-white text-center text-base font-bold tabular-nums text-ink [appearance:textfield] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-aqua [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <button type="button" className={stepBtn} onClick={() => setQuantity(Math.min(max, qty + 1))} disabled={!canBuy || qty >= max} aria-label="Eén meer">
              +
            </button>
          </div>
        </div>
        <button type="submit" disabled={!canBuy} aria-busy={pending} className="btn-accent btn-lg min-w-0 flex-1 basis-56">
          {canBuy && <CartIcon className="h-5 w-5" />}
          {canBuy ? (pending ? "Toevoegen…" : "In winkelwagen") : "Uitverkocht"}
        </button>
      </div>

      {canBuy && trackStock && curStock <= 5 && <p className="text-sm font-medium text-coral-600">{curStock === 1 ? "Nog 1 stuk op voorraad" : `Nog ${curStock} stuks op voorraad`}</p>}

      <div role="status" aria-live="polite">
        {status && (
          <p className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-4 py-3 text-sm font-medium animate-pop ${status.ok ? "bg-success-100 text-success" : "bg-coral-100 text-danger"}`}>
            <span>{status.text}</span>
            {status.ok && (
              <Link href="/winkelwagen/" className="font-bold underline underline-offset-2">
                Bekijk winkelwagen
              </Link>
            )}
          </p>
        )}
      </div>
    </form>
  );
}
