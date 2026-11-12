// Bedragen staan overal in centen (incl. btw). Geen server-only: ook client components gebruiken dit.

const fmt = new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 2495 → "€ 24,95" */
export const money = (cents: number) => `€ ${fmt.format(cents / 100)}`;

/** 2495 → { euros: "24", cents: "95" } voor prijsblokken met kleine centen */
export const moneyParts = (cents: number) => {
  const [euros, c] = fmt.format(cents / 100).split(",");
  return { euros, cents: c };
};

/** btw-bedrag dat in een bedrag incl. btw zit */
export const vatOf = (cents: number, rate: number) => Math.round(cents - cents / (1 + rate / 100));

/** "24,95" of "24.95" → 2495 (null bij ongeldige invoer) */
export function toCents(input: string) {
  const v = Number(input.trim().replace(/\s|€/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) : null;
}

/** Kortingspercentage t.o.v. de van-prijs (0 als er geen korting is). */
export const discountPct = (price: number, compareAt?: number | null) => (compareAt && compareAt > price ? Math.round((1 - price / compareAt) * 100) : 0);
