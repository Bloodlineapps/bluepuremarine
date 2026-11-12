import "server-only";
import type { Metadata } from "next";
import { money } from "./money";
import { BRAND, SITE_URL, absUrl, type ShopSettings, type SiteSettings } from "./settings";
import { clip, plain } from "./text";

// Eén herbruikbare SEO-laag: elke route bouwt zijn metadata via buildMetadata() en zijn JSON-LD via de helpers
// hieronder. Alle URL's zijn absoluut (SITE_URL: https met www) en eindigen op een slash. Gepagineerde pagina's
// hebben een canonical naar zichzelf (?pagina=N); gefilterde of gesorteerde lijsten zijn noindex,follow met een
// canonical naar de schone variant.

export type Crumb = { name: string; path: string };

export function canonical(path: string, page = 1) {
  const clean = path.split(/[?#]/)[0];
  const base = `${SITE_URL}${clean.endsWith("/") ? clean : `${clean}/`}`;
  return page > 1 ? `${base}?pagina=${page}` : base;
}

/** og:image van 1200×630: /og/<pad>.jpg snijdt een afbeelding uit /uploads/ op maat (zie app/og/[...file]/route.ts). */
export function ogImageUrl(src?: string | null) {
  if (!src) return `${SITE_URL}/og-default.jpg`;
  if (src.startsWith("/uploads/")) return `${SITE_URL}/og/${src.slice("/uploads/".length).replace(/\.webp$/, "")}.jpg`;
  return absUrl(src);
}

const SUFFIX = ` | ${BRAND}`;
const brandEnd = new RegExp(`\\s*[|–-]\\s*${BRAND}\\s*$`, "i");
const pageNote = (page: number) => (page > 1 ? ` – pagina ${page}` : "");

export const withBrand = (title: string) => (brandEnd.test(title) ? title : `${title}${SUFFIX}`);

/**
 * Title van 45–60 tekens: zoekwoord vooraan, eindigt op "| BluePure Marine". Te lange namen worden afgekapt; te
 * korte aangevuld met de `extras` (bv. " kopen", " voor je boot") zolang het past.
 */
export function seoTitle(main: string, extras: string[] = [], page = 1) {
  const tail = `${pageNote(page)}${SUFFIX}`;
  const room = 60 - tail.length;
  let t = main.replace(brandEnd, "").trim();
  if (t.length > room) t = clip(t, room);
  else
    for (const e of extras) {
      if (t.length + tail.length >= 45) break;
      if ((t + e).length <= room) t += e;
    }
  return `${t}${tail}`;
}

/** Een in het beheer ingevulde title blijft zoals hij is (met merknaam erachter); anders een gegenereerde. */
export const titleFor = (metaTitle: string | null | undefined, main: string, extras: string[] = [], page = 1) =>
  metaTitle?.trim() ? `${metaTitle.trim().replace(brandEnd, "")}${pageNote(page)}${SUFFIX}` : seoTitle(main, extras, page);

/** Description van 140–160 tekens: de eigen tekst, zo nodig aangevuld met vaste zinnen (levering, bedenktijd). */
export function seoDescription(text: string | null | undefined, extras: string[] = [], page = 1) {
  const note = pageNote(page);
  const max = 160 - note.length;
  let d = plain(text);
  for (const e of extras) {
    if (d.length >= 140 - note.length) break;
    const next = d ? `${d.replace(/[.!?…:;,\s]*$/, ".")} ${e}` : e;
    if (next.length <= max) d = next;
  }
  return `${clip(d, max)}${note}`;
}

/** Vaste zinnen uit de winkelinstellingen om korte descriptions mee aan te vullen. */
export function shopTails(shop: ShopSettings) {
  return [
    shop.deliveryNote ? `${shop.deliveryNote.replace(/[.!]$/, "")}.` : "",
    shop.freeShippingFrom > 0 ? `Gratis verzending vanaf ${money(shop.freeShippingFrom)}.` : "",
    shop.returnDays > 0 ? `${shop.returnDays} dagen bedenktijd.` : "",
    `Persoonlijk advies van ${BRAND}.`,
    "Veilig online betalen.",
  ].filter(Boolean);
}

/** Oude naam, nog in gebruik: description uit tekst of HTML, maximaal 160 tekens. */
export function describe(text: string | null | undefined, fallbackHtml?: string | null) {
  return clip((text && text.trim()) || plain(fallbackHtml), 160);
}

export function buildMetadata(opts: {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  type?: "website" | "article";
  /** niet indexeren en geen canonical (zoeken, 404, concept) */
  noindex?: boolean;
  /** paginanummer van een lijst (canonical krijgt ?pagina=N) */
  page?: number;
  /** gefilterd of gesorteerd: noindex,follow met canonical naar de schone (gepagineerde) URL */
  filtered?: boolean;
  publishedTime?: Date;
  modifiedTime?: Date;
}): Metadata {
  const url = canonical(opts.path, opts.page ?? 1);
  const image = ogImageUrl(opts.image);
  const index = !opts.noindex && !opts.filtered;
  return {
    title: { absolute: opts.title },
    description: opts.description,
    alternates: opts.noindex ? undefined : { canonical: url },
    robots: index ? { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } : { index: false, follow: true },
    openGraph: {
      title: opts.title,
      description: opts.description,
      url,
      siteName: BRAND,
      locale: "nl_NL",
      images: [{ url: image, width: 1200, height: 630, alt: opts.title }],
      ...(opts.type === "article"
        ? { type: "article" as const, ...(opts.publishedTime ? { publishedTime: opts.publishedTime.toISOString() } : {}), ...(opts.modifiedTime ? { modifiedTime: opts.modifiedTime.toISOString() } : {}) }
        : { type: "website" as const }),
    },
    twitter: { card: "summary_large_image", title: opts.title, description: opts.description, images: [image] },
  };
}

export const notFoundMetadata: Metadata = { title: { absolute: `Pagina niet gevonden${SUFFIX}` }, robots: { index: false, follow: true } };

// ---------- JSON-LD ----------

export const ORG_ID = `${SITE_URL}/#organization`;
export const SITE_ID = `${SITE_URL}/#website`;

/** Organization + WebSite (met zoekactie): staat via de layout op elke publieke pagina. */
export function organizationLd(site: SiteSettings) {
  const sameAs = Object.values(site.socials).filter(Boolean);
  const hasAddress = !!(site.street && site.city);
  return [
    {
      "@type": "Organization",
      "@id": ORG_ID,
      name: site.name,
      ...(site.legalName && site.legalName !== site.name ? { legalName: site.legalName } : {}),
      ...(site.tagline ? { description: site.tagline } : {}),
      url: `${SITE_URL}/`,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/icon-512.png`, width: 512, height: 512 },
      ...(site.email ? { email: site.email } : {}),
      ...(site.phoneIntl ? { telephone: site.phoneIntl } : {}),
      ...(sameAs.length ? { sameAs } : {}),
      ...(hasAddress ? { address: { "@type": "PostalAddress", streetAddress: site.street, ...(site.postalCode ? { postalCode: site.postalCode } : {}), addressLocality: site.city, addressCountry: site.country || "NL" } } : {}),
      ...(site.email || site.phoneIntl ? { contactPoint: { "@type": "ContactPoint", ...(site.email ? { email: site.email } : {}), ...(site.phoneIntl ? { telephone: site.phoneIntl } : {}), contactType: "customer service", availableLanguage: ["nl"] } } : {}),
      ...(site.vat ? { vatID: site.vat } : {}),
      ...(site.kvk ? { identifier: { "@type": "PropertyValue", propertyID: "KvK", value: site.kvk } } : {}),
    },
    {
      "@type": "WebSite",
      "@id": SITE_ID,
      name: site.name,
      url: `${SITE_URL}/`,
      publisher: { "@id": ORG_ID },
      inLanguage: "nl-NL",
      potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/zoeken/?q={search_term_string}` }, "query-input": "required name=search_term_string" },
    },
  ];
}

export function webPageLd(p: { path: string; title: string; description: string; image?: string | null; modified?: Date }) {
  return {
    "@type": "WebPage",
    "@id": `${canonical(p.path)}#webpage`,
    url: canonical(p.path),
    name: p.title,
    ...(p.description ? { description: p.description } : {}),
    inLanguage: "nl-NL",
    isPartOf: { "@id": SITE_ID },
    ...(p.image ? { primaryImageOfPage: absUrl(p.image) } : {}),
    ...(p.modified ? { dateModified: p.modified.toISOString() } : {}),
  };
}

export function breadcrumbLd(crumbs: Crumb[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Home", path: "/" }, ...crumbs].map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: canonical(c.path) })),
  };
}

export function faqLd(items: { question: string; answer: string }[]) {
  return { "@type": "FAQPage", mainEntity: items.map((f) => ({ "@type": "Question", name: plain(f.question), acceptedAnswer: { "@type": "Answer", text: plain(f.answer) } })) };
}

export function itemListLd(name: string, items: { name: string; path: string }[]) {
  return { "@type": "ItemList", name, numberOfItems: items.length, itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, url: canonical(it.path), name: it.name })) };
}

const euros = (cents: number) => (cents / 100).toFixed(2);

/**
 * Product met Offer (prijs, voorraad, verzendkosten NL, retourtermijn). aggregateRating en review alleen als er
 * goedgekeurde reviews van dit product op de pagina staan.
 */
export function productLd(
  p: { path: string; name: string; description: string; images: string[]; sku?: string | null; ean?: string | null; brand?: string | null; price: number; inStock: boolean },
  shop: ShopSettings,
  reviews: { name: string; rating: number; title: string; text: string; date: Date }[] = [],
  summary: { count: number; average: number } = { count: 0, average: 0 },
) {
  const nl = shop.shipping.find((s) => s.country === "NL");
  const free = shop.freeShippingFrom > 0 && p.price >= shop.freeShippingFrom;
  const url = canonical(p.path);
  const withReviews = summary.count > 0 && reviews.length > 0;
  return {
    "@type": "Product",
    "@id": `${url}#product`,
    name: p.name,
    url,
    ...(p.images.length ? { image: p.images.map(absUrl) } : {}),
    ...(p.description ? { description: p.description } : {}),
    ...(p.sku ? { sku: p.sku } : {}),
    ...(p.ean && /^\d{8,14}$/.test(p.ean) ? { gtin: p.ean } : {}),
    ...(p.brand ? { brand: { "@type": "Brand", name: p.brand } } : {}),
    offers: {
      "@type": "Offer",
      url,
      price: euros(p.price),
      priceCurrency: "EUR",
      availability: p.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@id": ORG_ID },
      ...(nl
        ? {
            shippingDetails: {
              "@type": "OfferShippingDetails",
              shippingRate: { "@type": "MonetaryAmount", value: euros(free ? 0 : nl.cost), currency: "EUR" },
              shippingDestination: { "@type": "DefinedRegion", addressCountry: "NL" },
            },
          }
        : {}),
      ...(shop.returnDays > 0
        ? {
            hasMerchantReturnPolicy: {
              "@type": "MerchantReturnPolicy",
              applicableCountry: "NL",
              returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
              merchantReturnDays: shop.returnDays,
              returnMethod: "https://schema.org/ReturnByMail",
            },
          }
        : {}),
    },
    ...(withReviews
      ? {
          aggregateRating: { "@type": "AggregateRating", ratingValue: summary.average, reviewCount: summary.count, bestRating: 5, worstRating: 1 },
          review: reviews.map((r) => ({
            "@type": "Review",
            author: { "@type": "Person", name: r.name },
            datePublished: r.date.toISOString().slice(0, 10),
            reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
            ...(r.title ? { name: r.title } : {}),
            reviewBody: plain(r.text),
          })),
        }
      : {}),
  };
}

export function blogPostingLd(p: { path: string; title: string; description: string; image?: string | null; published: Date; modified: Date }) {
  const url = canonical(p.path);
  return {
    "@type": "BlogPosting",
    "@id": `${url}#article`,
    headline: p.title,
    ...(p.description ? { description: p.description } : {}),
    url,
    mainEntityOfPage: url,
    datePublished: p.published.toISOString(),
    dateModified: p.modified.toISOString(),
    author: { "@type": "Organization", "@id": ORG_ID, name: BRAND },
    publisher: { "@id": ORG_ID },
    inLanguage: "nl-NL",
    ...(p.image ? { image: [ogImageUrl(p.image)] } : {}),
  };
}

export function graph(...nodes: (object | object[] | null | undefined | false | 0 | "")[]) {
  return { "@context": "https://schema.org", "@graph": nodes.flat().filter((n): n is object => !!n && typeof n === "object") };
}
