// Statussen van bestellingen en betalingen met label en kleurtoon. Bewust zonder server-only: ook client components
// (beheer en account) mogen dit importeren. `src/lib/orders.ts` exporteert dezelfde constanten opnieuw.

export type StatusTone = "neutral" | "success" | "warning" | "danger" | "brand";
export type StatusInfo = { label: string; tone: StatusTone };

export const ORDER_STATUS: Record<string, StatusInfo> = {
  pending: { label: "Wacht op betaling", tone: "warning" },
  paid: { label: "Betaald", tone: "success" },
  shipped: { label: "Verzonden", tone: "brand" },
  completed: { label: "Afgerond", tone: "neutral" },
  cancelled: { label: "Geannuleerd", tone: "danger" },
  refunded: { label: "Terugbetaald", tone: "neutral" },
};

export const PAYMENT_STATUS: Record<string, StatusInfo> = {
  open: { label: "Open", tone: "warning" },
  paid: { label: "Betaald", tone: "success" },
  failed: { label: "Mislukt", tone: "danger" },
  expired: { label: "Verlopen", tone: "danger" },
  canceled: { label: "Geannuleerd", tone: "neutral" },
  refunded: { label: "Terugbetaald", tone: "neutral" },
  partially_refunded: { label: "Deels terugbetaald", tone: "warning" },
};

export const PAYMENT_PROVIDER: Record<string, string> = { mollie: "Online betaling (Mollie)", simulatie: "Testbetaling", overboeking: "Overboeking" };

/** Tailwind-klassen per toon, voor een statuslabel (combineer met de klasse `badge`). */
export const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "bg-paper-2 text-muted",
  success: "bg-success-100 text-success",
  warning: "bg-sun-100 text-ink",
  danger: "bg-coral-100 text-danger",
  brand: "bg-brand-100 text-brand-700",
};

/** Adres zoals het als momentopname (JSON) bij een bestelling wordt bewaard. */
export type OrderAddress = { firstName: string; lastName: string; company: string; street: string; houseNumber: string; addition: string; postalCode: string; city: string; country: string };

export const COUNTRY_NAMES: Record<string, string> = { NL: "Nederland", BE: "België", DE: "Duitsland", LU: "Luxemburg", FR: "Frankrijk" };

/** Adres in regels, bv. ["Jan Jansen", "Kade 12 A", "1234 AB Waspik", "Nederland"]. */
export function addressLines(a: Partial<OrderAddress> | null | undefined): string[] {
  if (!a) return [];
  return [
    a.company || "",
    [a.firstName, a.lastName].filter(Boolean).join(" "),
    [a.street, a.houseNumber, a.addition].filter(Boolean).join(" "),
    [a.postalCode, a.city].filter(Boolean).join(" "),
    COUNTRY_NAMES[a.country ?? ""] ?? a.country ?? "",
  ].filter(Boolean);
}
