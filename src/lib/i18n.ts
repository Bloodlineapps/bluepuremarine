// De site is alleen Nederlandstalig. De taal-API uit de basis blijft bestaan (beheer en formulieren gebruiken hem);
// vaste interfaceteksten staan in src/i18n/nl.json, content in de database.
// Geen server-only: ook gebruikt in client components (cookiebanner, formulieren, menu).
import nl from "@/i18n/nl.json";

export const LOCALES = ["nl"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "nl";

export type Dict = typeof nl;
const DICTS: Record<Locale, Dict> = { nl };

export const isLocale = (v: unknown): v is Locale => LOCALES.includes(v as Locale);
export const dict = (locale: Locale) => DICTS[locale] ?? DICTS.nl;

/** "{name}"-velden invullen. */
export const fmt = (s: string, vars: Record<string, string | number> = {}) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));

export const localeOfPath = (path: string): Locale => "nl";
export const homePath = (locale: Locale) => "/";

/** html lang, og:locale en hreflang per taal. */
export const LOCALE_META: Record<Locale, { lang: string; og: string; hreflang: string; name: string; dateLocale: string }> = {
  nl: { lang: "nl", og: "nl_NL", hreflang: "nl", name: "Nederlands", dateLocale: "nl-NL" },
};

export const formatDate = (d: Date, locale: Locale) => new Intl.DateTimeFormat(LOCALE_META[locale].dateLocale, { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Amsterdam" }).format(d);
