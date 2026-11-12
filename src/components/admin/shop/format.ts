// Kleine hulpjes voor het webshopbeheer (ook bruikbaar in client components).

type Tone = "neutral" | "success" | "warning" | "danger" | "brand";

/** 2495 → "24,95" (voor invoervelden en CSV; leeg bij null) */
export const euros = (cents: number | null | undefined) => (cents == null ? "" : (cents / 100).toFixed(2).replace(".", ","));

/** 4 → "★★★★☆" */
export const stars = (n: number) => "★".repeat(Math.max(0, Math.min(5, n))) + "☆".repeat(5 - Math.max(0, Math.min(5, n)));

export const VAT_RATES = [21, 9, 0];

export const DISCOUNT_TYPES: Record<string, string> = { percent: "Percentage", fixed: "Vast bedrag", shipping: "Gratis verzending" };

export const REVIEW_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "Wacht op beoordeling", tone: "warning" },
  approved: { label: "Goedgekeurd", tone: "success" },
  rejected: { label: "Afgewezen", tone: "danger" },
};

export const PAYMENT_PROVIDERS: Record<string, string> = { mollie: "Mollie", simulatie: "Testbetaling (simulatie)", overboeking: "Overboeking" };
export const MAIL_LABELS: Record<string, string> = { bevestiging: "Orderbevestiging", verzonden: "Verzendbevestiging", geannuleerd: "Annuleringsmail", terugbetaald: "Terugbetalingsmail", winkel: "Melding aan de winkel" };
export const COUNTRIES: Record<string, string> = { NL: "Nederland", BE: "België", DE: "Duitsland" };

/** Adres zoals het als momentopname (JSON) bij een bestelling staat. */
export type OrderAddress = { firstName?: string; lastName?: string; company?: string; street?: string; houseNumber?: string; addition?: string; postalCode?: string; city?: string; country?: string };

export function addressOf(json: string | null | undefined): OrderAddress {
  try {
    return (JSON.parse(json || "{}") as OrderAddress) ?? {};
  } catch {
    return {};
  }
}
export const fullName = (a: OrderAddress) => [a.firstName, a.lastName].filter(Boolean).join(" ");
export const addressLines = (a: OrderAddress) =>
  [a.company, fullName(a), [a.street, [a.houseNumber, a.addition].filter(Boolean).join(" ")].filter(Boolean).join(" "), [a.postalCode, a.city].filter(Boolean).join(" "), a.country ? (COUNTRIES[a.country] ?? a.country) : ""].filter((l): l is string => !!l);

/** Blog: "gepland" = gepubliceerd met een publicatiedatum in de toekomst (de site toont alleen publishedAt <= nu). */
export const postState = (p: { status: string; publishedAt: Date }) => (p.status === "draft" ? "draft" : p.publishedAt.getTime() > Date.now() ? "scheduled" : "published");
export const POST_STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "Concept", tone: "warning" },
  scheduled: { label: "Gepland", tone: "brand" },
  published: { label: "Gepubliceerd", tone: "success" },
};

/** Voorraadkleur in overzichten: rood bij 0, oranje bij 3 of minder. */
export const stockTone = (p: { trackStock: boolean; stock: number }) => (!p.trackStock ? "text-ink-soft" : p.stock <= 0 ? "font-semibold text-danger" : p.stock <= 3 ? "font-semibold text-[#b86e00]" : "");
