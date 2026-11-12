import "server-only";
import { cache } from "react";
import { db } from "./db";
import { parse } from "./json";

// Eén centrale plek voor bedrijfsgegevens en winkelinstellingen: header, footer, meta-tags, structured data, sitemap,
// robots.txt, winkelwagen en e-mails lezen allemaal hieruit. Standaardwaarden komen van www.bluepuremarine.com;
// beheer via /admin/instellingen/ en /admin/connecties/. Lege velden worden nergens getoond.

export const SITE_URL = (process.env.SITE_URL || "https://www.bluepuremarine.com").replace(/\/$/, "");
export const BRAND = "BluePure Marine";

export type SiteSettings = {
  name: string;
  legalName: string;
  /** korte omschrijving voor footer en structured data */
  tagline: string;
  email: string;
  phone: string;
  /** internationaal formaat, bv. +31611791623 */
  phoneIntl: string;
  /** WhatsApp-nummer in internationaal formaat zonder +, bv. 31611791623 (leeg = geen WhatsApp-knop) */
  whatsapp: string;
  /** eerste bericht dat in WhatsApp wordt klaargezet */
  whatsappText: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  kvk: string;
  vat: string;
  /** bv. "09:00 tot 17:00" */
  serviceHours: string;
  socials: { facebook: string; instagram: string; x: string; linkedin: string; youtube: string };
};

export const DEFAULT_SITE: SiteSettings = {
  name: BRAND,
  legalName: "BluePure Marine",
  tagline: "Onderhoudsmiddelen en bootonderdelen van merken die je kunt vertrouwen.",
  email: "info@bluepuremarine.com",
  phone: "+31 6 11791623",
  phoneIntl: "+31611791623",
  whatsapp: "31611791623",
  whatsappText: "Hallo BluePure Marine, ik heb een vraag over ",
  street: "Herman Boerhaavestraat 18",
  postalCode: "",
  city: "Waspik",
  country: "NL",
  kvk: "42077731",
  vat: "NL005476895B23",
  serviceHours: "",
  socials: { facebook: "", instagram: "", x: "", linkedin: "", youtube: "" },
};

/** Winkelinstellingen. Bedragen in centen incl. btw. */
export type ShopSettings = {
  /** verzendkosten per land (ISO-code); landen die hier niet staan zijn niet te kiezen bij het afrekenen */
  shipping: { country: string; label: string; cost: number }[];
  /** gratis verzending vanaf dit orderbedrag (0 = nooit gratis) */
  freeShippingFrom: number;
  /** standaard levertijd-tekst op productpagina's */
  deliveryNote: string;
  /** aantal dagen bedenktijd */
  returnDays: number;
  /** drie korte voordelen in de balk bovenaan en in de footer */
  usps: string[];
  /** producten per pagina in categorieën en zoekresultaten */
  perPage: number;
  /** voorvoegsel + startnummer van bestelnummers */
  orderPrefix: string;
  /** e-mailadres dat een melding krijgt bij elke nieuwe betaalde bestelling (leeg = e-mailadres van de winkel) */
  orderNotifyEmail: string;
  /** rekeningnummer voor betalen per overboeking (alleen getoond als Mollie uit staat en simulatie uit staat) */
  iban: string;
};

export const DEFAULT_SHOP: ShopSettings = {
  shipping: [
    { country: "NL", label: "Nederland", cost: 695 },
    { country: "BE", label: "België", cost: 995 },
    { country: "DE", label: "Duitsland", cost: 1295 },
  ],
  freeShippingFrom: 7500,
  deliveryNote: "Voor 16:00 besteld, vandaag verzonden",
  returnDays: 14,
  usps: ["Gratis verzending vanaf € 75,-", "14 dagen bedenktijd", "Snel en veilig online betalen"],
  perPage: 12,
  orderPrefix: "BP-",
  orderNotifyEmail: "",
  iban: "",
};

/** Reviewscore in de header (Google-reviews). Zonder score toont de site alleen de link "Google reviews". */
export type ReviewSettings = {
  enabled: boolean;
  /** "google" | "site": bron van het cijfer; "site" rekent met de goedgekeurde reviews in /admin/reviews/ */
  source: "google" | "site";
  /** gemiddelde op een schaal van 5, bv. 4.8 (0 = onbekend) */
  rating: number;
  count: number;
  /** link naar het Google-bedrijfsprofiel of de reviewpagina */
  url: string;
  updatedAt?: string;
};

export const DEFAULT_REVIEWS: ReviewSettings = { enabled: true, source: "site", rating: 0, count: 0, url: "" };

type LastTest = { ok: boolean; at: string; message: string };

export type Connections = {
  /** Google Tag Manager: container in de head van elke publieke pagina (nooit in het beheer). */
  gtm: { enabled: boolean; containerId: string; headCode: string; bodyCode: string; lastTest?: LastTest };
  /** GA4 direct (alleen als GTM uit staat; anders via GTM), altijd met Consent Mode v2. */
  ga4: { enabled: boolean; measurementId: string; propertyId: string; serviceAccountEnc: string; serviceAccountHint: string; lastTest?: LastTest };
  /** Google Search Console: verificatie-meta-tag + sitemap-URL. */
  gsc: { enabled: boolean; verification: string; lastTest?: LastTest };
  /** Google Reviews via de Places API: haalt score en aantal reviews op voor de header. */
  googleReviews: { enabled: boolean; placeId: string; keyEnc: string; keyHint: string; lastTest?: LastTest };
  /**
   * Mollie: sleutels voor test en live. `simulate` = testbetalingen simuleren zonder Mollie-sleutel (lokaal testen):
   * de klant komt dan op /afrekenen/testbetaling/ en kiest zelf betaald, mislukt of geannuleerd.
   */
  mollie: { enabled: boolean; mode: "test" | "live"; simulate: boolean; testKeyEnc: string; testKeyHint: string; liveKeyEnc: string; liveKeyHint: string; methods: string[]; lastTest?: LastTest };
  /** SparkPost: verstuurt alle e-mails van de site (bestelmails, formuliermeldingen, bevestigingen). */
  sparkpost: { enabled: boolean; region: "us" | "eu"; fromEmail: string; fromName: string; replyTo: string; keyEnc: string; keyHint: string; domainStatus?: string; lastTest?: LastTest };
  /** AI: alleen via de eigen server (meta-voorstellen in het beheer). */
  ai: { enabled: boolean; provider: "openai" | "anthropic"; model: string; keyEnc: string; keyHint: string; monthlyLimit: number; usage?: { month: string; count: number }; lastTest?: LastTest };
};

export const DEFAULT_CONNECTIONS: Connections = {
  gtm: { enabled: false, containerId: "", headCode: "", bodyCode: "" },
  ga4: { enabled: false, measurementId: "", propertyId: "", serviceAccountEnc: "", serviceAccountHint: "" },
  gsc: { enabled: false, verification: "" },
  googleReviews: { enabled: false, placeId: "", keyEnc: "", keyHint: "" },
  mollie: { enabled: false, mode: "test", simulate: false, testKeyEnc: "", testKeyHint: "", liveKeyEnc: "", liveKeyHint: "", methods: [] },
  sparkpost: { enabled: false, region: "eu", fromEmail: "info@bluepuremarine.com", fromName: BRAND, replyTo: "info@bluepuremarine.com", keyEnc: "", keyHint: "" },
  ai: { enabled: false, provider: "anthropic", model: "claude-haiku-5-5", keyEnc: "", keyHint: "", monthlyLimit: 500 },
};

async function read<T>(key: string, fallback: T): Promise<T> {
  const row = await db.setting.findUnique({ where: { key } });
  const value = parse<Partial<T>>(row?.value, {});
  return { ...fallback, ...value };
}

export const getSite = cache(() => read("site", DEFAULT_SITE));
export const getShop = cache(() => read("shop", DEFAULT_SHOP));
export const getReviewSettings = cache(() => read("reviews", DEFAULT_REVIEWS));
export const getConnections = cache(async () => {
  const c = await read("connections", DEFAULT_CONNECTIONS);
  return Object.fromEntries(Object.entries(DEFAULT_CONNECTIONS).map(([k, v]) => [k, { ...v, ...((c as Record<string, object>)[k] ?? {}) }])) as Connections;
});

// ---------- SEO (algemeen) ----------
export type SeoSettings = { bingVerification: string };
export const DEFAULT_SEO: SeoSettings = { bingVerification: "" };
export const getSeo = cache(() => read("seo", DEFAULT_SEO));

export async function saveSetting(key: string, value: unknown) {
  const json = JSON.stringify(value);
  await db.setting.upsert({ where: { key }, create: { key, value: json }, update: { value: json } });
}

export const absUrl = (path: string) => (/^https?:\/\//.test(path) ? path : `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`);
