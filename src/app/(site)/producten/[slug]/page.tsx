import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { ProductBuyForm } from "@/components/shop/ProductBuyForm";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { Gallery } from "@/components/site/Gallery";
import { Html } from "@/components/site/Html";
import { JsonLd } from "@/components/site/JsonLd";
import { ProductGrid } from "@/components/site/ProductCard";
import { Stars } from "@/components/site/ReviewBadge";
import { ReviewForm } from "@/components/site/ReviewForm";
import { TruckIcon } from "@/components/site/icons";
import { Accordion, ReviewCard, SectionHeading } from "@/components/site/ui";
import { pagePaths } from "@/lib/content";
import { productCrumbs } from "@/lib/crumbs";
import { db } from "@/lib/db";
import { parse } from "@/lib/json";
import { discountPct, money } from "@/lib/money";
import { breadcrumbLd, buildMetadata, graph, notFoundMetadata, productLd, seoDescription, shopTails, titleFor } from "@/lib/seo";
import { getShop } from "@/lib/settings";
import { approvedReviews, boughtTogether, imagesOf, inStock, live, productBySlug, realBrand, relatedProducts, reviewSummary, specsOf, type Spec } from "@/lib/shop";
import { plain } from "@/lib/text";

// Productpagina. Vooraf gerenderd voor alle gepubliceerde producten; nieuwe producten worden bij het eerste bezoek
// gerenderd en het beheer ververst de pagina na opslaan (revalidatePath). Een uitverkocht product blijft bereikbaar.

type Props = { params: Promise<{ slug: string }> };

/**
 * Veel omschrijvingen eindigen met een eigen tabel "Specificaties", terwijl dezelfde gegevens ook als losse
 * specificaties zijn opgeslagen. Om geen twee tabellen onder elkaar te tonen halen we een tabel met twee kolommen
 * (en de kop "Specificaties" erboven) uit de omschrijving; de rijen ervan komen in het blok Specificaties.
 */
function splitSpecTable(html: string): { html: string; rows: Spec[] } | null {
  const m = html.match(/(?:<h[2-4][^>]*>\s*(?:Technische\s+)?(?:Specificaties|Productspecificaties|Kenmerken en specificaties)\s*<\/h[2-4]>\s*)?<table[\s\S]*?<\/table>/i);
  if (!m) return null;
  const trs = [...m[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((r) => [...r[1].matchAll(/<(td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map((c) => ({ head: c[1].toLowerCase() === "th", text: plain(c[2]) })));
  if (!trs.length || trs.some((r) => r.length !== 2)) return null;
  const rows = trs.filter((r) => !(r[0].head && r[1].head)).map((r) => ({ label: r[0].text.replace(/:$/, ""), value: r[1].text })).filter((r) => r.label && r.value);
  return rows.length ? { html: html.replace(m[0], ""), rows } : null;
}

export const dynamicParams = true;
export const revalidate = 3600;

export async function generateStaticParams() {
  try {
    return (await db.product.findMany({ where: live, select: { slug: true } })).map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await productBySlug((await params).slug);
  if (!p) return notFoundMetadata;
  const shop = await getShop();
  const b = realBrand(p.brand);
  const brand = b && !p.name.toLowerCase().includes(b.name.toLowerCase()) ? ` van ${b.name}` : "";
  return buildMetadata({
    title: titleFor(p.metaTitle, p.name, [" kopen", brand, " online"].filter(Boolean)),
    description: seoDescription(p.metaDescription || p.lead || p.subtitle || plain(p.description) || p.name, shopTails(shop)),
    path: p.path,
    image: imagesOf(p)[0]?.src,
    noindex: p.noindex,
    modifiedTime: p.updatedAt,
  });
}

export default async function ProductPage({ params }: Props) {
  const p = await productBySlug((await params).slug);
  if (!p) notFound();
  const [shop, reviews, summary, together, related, paths] = await Promise.all([getShop(), approvedReviews(p.id, 20), reviewSummary(p.id), boughtTogether(p.id, 4), relatedProducts(p, 4), pagePaths()]);
  const images = imagesOf(p);
  const brand = realBrand(p.brand);
  // geen "Merk: Overige merken" in de specificaties
  const saved = specsOf(p).filter((s) => s.label && s.value && !(s.label.toLowerCase() === "merk" && !brand));
  const split = p.description ? splitSpecTable(p.description) : null;
  const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  // staat er een tabel in de omschrijving, dan is die de bron (alleen het merk komt er zo nodig bij)
  const specs = split ? [...saved.filter((s) => key(s.label) === "merk" && !split.rows.some((r) => key(r.label) === "merk")), ...split.rows] : saved;
  const descriptionHtml = split ? split.html : p.description;
  const available = inStock(p);
  const crumbs = productCrumbs(p);
  const pct = discountPct(p.price, p.compareAtPrice);
  const delivery = p.deliveryNote || shop.deliveryNote;
  const nl = shop.shipping.find((s) => s.country === "NL");
  const free = shop.freeShippingFrom > 0 && p.price >= shop.freeShippingFrom;
  const variants = p.variants.map((v) => ({ id: v.id, name: v.name, options: parse<string[]>(v.options, []), price: v.price, compareAtPrice: v.compareAtPrice, stock: v.stock }));
  const description = seoDescription(p.lead || p.subtitle || plain(p.description) || p.name);
  const hasReviews = summary.count > 0 && reviews.length > 0;

  return (
    <>
      <JsonLd
        data={graph(
          breadcrumbLd(crumbs),
          productLd({ path: p.path, name: p.name, description, images: images.map((i) => i.src), sku: p.sku, ean: p.ean, brand: brand?.name, price: p.price, inStock: available }, shop, hasReviews ? reviews : [], summary),
        )}
      />

      <div className="container-x pt-5 lg:pt-7">
        <Breadcrumbs items={crumbs} />

        <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-12">
          <Gallery
            images={images}
            name={p.name}
            badge={
              <>
                {pct > 0 && <span className="badge-sale px-3 py-1 text-[0.85rem]">-{pct}%</span>}
                {!available && <span className="badge-out px-3 py-1 text-[0.85rem]">Uitverkocht</span>}
              </>
            }
          />

          <div>
            {brand && (
              <Link href={`/merken/${brand.slug}/`} className="eyebrow underline-grow inline-flex min-h-8 items-center" aria-label={`Alle producten van ${brand.name}`}>
                {brand.name}
              </Link>
            )}
            <h1 className="mt-1 text-[clamp(1.6rem,1.25rem+1.5vw,2.35rem)]">{p.name}</h1>
            {p.subtitle && <p className="mt-2 text-[length:var(--text-lede)] text-muted">{p.subtitle}</p>}
            {hasReviews && (
              <a href="#reviews" className="group mt-3 inline-flex min-h-9 items-center gap-2">
                <Stars rating={summary.average} className="text-[1.1rem]" />
                <span className="text-[0.92rem] text-muted underline-offset-4 group-hover:text-brand group-hover:underline">
                  {summary.average.toLocaleString("nl-NL", { minimumFractionDigits: 1 })} / 5 · {summary.count} {summary.count === 1 ? "review" : "reviews"}
                </span>
              </a>
            )}
            {p.lead && <p className="mt-4 max-w-[62ch]">{p.lead}</p>}

            <div id="kopen" className="card mt-6 scroll-mt-4 p-5 sm:p-6">
              <ProductBuyForm productId={p.id} price={p.price} compareAtPrice={p.compareAtPrice} inStock={available} stock={p.stock} trackStock={p.trackStock} optionNames={parse<string[]>(p.optionNames, [])} variants={variants} />
              <p className={`mt-4 flex items-start gap-2 font-semibold ${available ? "text-success" : "text-danger"}`}>
                <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${available ? "bg-success" : "bg-danger"}`} aria-hidden="true" />
                <span>
                  {available ? "Op voorraad" : "Uitverkocht"}
                  {available && delivery && <span className="font-normal text-ink-2"> · {delivery}</span>}
                  {!available && <span className="block font-normal text-ink-2">Dit product is op dit moment niet leverbaar. Neem contact met ons op als je wilt weten wanneer het terugkomt.</span>}
                </span>
              </p>
            </div>

            <ul className="mt-5 space-y-2 text-[0.95rem]">
              {shop.freeShippingFrom > 0 && (
                <li className="flex items-start gap-2.5">
                  <Icon name="check" className="mt-0.5 h-5 w-5 shrink-0 text-success" strokeWidth={2.6} />
                  Gratis verzending vanaf {money(shop.freeShippingFrom)}
                </li>
              )}
              {shop.returnDays > 0 && (
                <li className="flex items-start gap-2.5">
                  <Icon name="check" className="mt-0.5 h-5 w-5 shrink-0 text-success" strokeWidth={2.6} />
                  {shop.returnDays} dagen bedenktijd
                </li>
              )}
              <li className="flex items-start gap-2.5">
                <Icon name="check" className="mt-0.5 h-5 w-5 shrink-0 text-success" strokeWidth={2.6} />
                Snel en veilig online betalen
              </li>
            </ul>
            {nl && (
              <p className="mt-4 flex items-start gap-2.5 rounded-lg bg-paper px-4 py-3 text-[0.92rem]">
                <TruckIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                <span>
                  {free ? "Dit product wordt gratis verzonden binnen Nederland." : `Verzendkosten binnen Nederland: ${money(nl.cost)}.`}{" "}
                  {paths.verzending && (
                    <Link href={paths.verzending} className="link">
                      Alles over verzending en levering
                    </Link>
                  )}
                </span>
              </p>
            )}
            {(p.sku || p.ean) && (
              <p className="mt-4 text-[0.84rem] text-muted">
                {[p.sku && `Artikelnummer: ${p.sku}`, p.ean && `EAN: ${p.ean}`].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>

        {/* omschrijving en uitklapblokken links, specificaties rechts */}
        <div className={`mt-[var(--spacing-section-sm)] grid items-start gap-x-12 gap-y-8 ${specs.length > 0 ? "lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]" : "max-w-4xl"}`}>
          <div className="border-t-2 border-navy">
          {descriptionHtml && (
            <Accordion title="Omschrijving" open>
              <Html html={descriptionHtml} className="max-w-[75ch]" />
            </Accordion>
          )}
          {p.usage && (
            <Accordion title="Gebruik en onderhoud">
              <Html html={p.usage} className="max-w-[75ch]" />
            </Accordion>
          )}
          <Accordion title="Verzending en retour">
            <div className="prose-bp max-w-[75ch]">
              {shop.deliveryNote && <p>{shop.deliveryNote.replace(/[.!]$/, "")}. We versturen je bestelling vanuit Waspik.</p>}
              {shop.shipping.length > 0 && (
                <ul>
                  {shop.shipping.map((s) => (
                    <li key={s.country}>
                      Verzending naar {s.label}: {s.cost > 0 ? money(s.cost) : "gratis"}
                    </li>
                  ))}
                  {shop.freeShippingFrom > 0 && <li>Gratis verzending bij een bestelling vanaf {money(shop.freeShippingFrom)}</li>}
                </ul>
              )}
              {shop.returnDays > 0 && <p>Niet tevreden of past het toch niet? Je hebt {shop.returnDays} dagen bedenktijd na ontvangst van je bestelling om het product terug te sturen.</p>}
              {(paths.verzending || paths.retourbeleid) && (
                <p>
                  {paths.verzending && <Link href={paths.verzending}>Lees meer over verzending</Link>}
                  {paths.verzending && paths.retourbeleid && " of "}
                  {paths.retourbeleid && <Link href={paths.retourbeleid}>bekijk het retourbeleid</Link>}.
                </p>
              )}
            </div>
          </Accordion>
          </div>
          {specs.length > 0 && (
            <section aria-labelledby="specificaties-titel" className="card overflow-hidden lg:sticky lg:top-4">
              <h2 id="specificaties-titel" className="border-b border-rule bg-paper px-5 py-4 text-[1.08rem]">
                Specificaties
              </h2>
              <table className="w-full border-collapse text-[0.93rem]">
                <caption className="sr-only">Specificaties van {p.name}</caption>
                <tbody>
                  {specs.map((s, i) => (
                    <tr key={`${i}-${s.label}`} className="border-b border-rule last:border-0 even:bg-paper/60">
                      <th scope="row" className="w-2/5 px-5 py-2.5 text-left align-top font-semibold text-ink">
                        {s.label}
                      </th>
                      <td className="px-5 py-2.5 align-top">{s.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>

        {/* reviews */}
        <section id="reviews" className="mt-[var(--spacing-section)] scroll-mt-4" aria-labelledby="reviews-titel">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
            <div>
              <p className="eyebrow">Reviews</p>
              <h2 id="reviews-titel" className="h-display mt-1 text-[length:var(--text-section)] text-navy">
                Ervaringen met dit product
              </h2>
            </div>
            {hasReviews && (
              <p className="flex items-center gap-3">
                <Stars rating={summary.average} className="text-[1.4rem]" />
                <span>
                  <span className="text-[1.3rem] font-extrabold text-ink">{summary.average.toLocaleString("nl-NL", { minimumFractionDigits: 1 })}</span>
                  <span className="text-muted"> / 5 · {summary.count} {summary.count === 1 ? "review" : "reviews"}</span>
                </span>
              </p>
            )}
          </div>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-12">
            <div>
              {hasReviews ? (
                <ul className="grid gap-4">
                  {reviews.map((r) => (
                    <li key={r.id}>
                      <ReviewCard review={r} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-card border border-rule bg-paper p-6">Er zijn nog geen reviews van dit product. Heb je het gekocht? Dan horen we graag wat je ervan vindt.</p>
              )}
            </div>
            <div className="card self-start p-5 sm:p-6">
              <h3 className="text-[length:var(--text-title)]">Schrijf een review</h3>
              <p className="mt-1 mb-4 text-[0.92rem] text-muted">Deel je ervaring met dit product. Je review verschijnt op de site nadat wij hem hebben gecontroleerd.</p>
              <ReviewForm productId={p.id} />
            </div>
          </div>
        </section>

        {together.length > 0 && (
          <section className="reveal mt-[var(--spacing-section)]" aria-labelledby="samen-titel">
            <SectionHeading id="samen-titel" eyebrow="Combineer" title="Vaak samen gekocht" />
            <ProductGrid products={together} />
          </section>
        )}

        {related.length > 0 && (
          <section className="reveal mt-[var(--spacing-section)]" aria-labelledby="gerelateerd-titel">
            <SectionHeading id="gerelateerd-titel" eyebrow="Ook interessant" title="Gerelateerde producten" href={p.primaryCategory?.path} linkLabel={p.primaryCategory ? `Alles in ${p.primaryCategory.navTitle || p.primaryCategory.name}` : undefined} />
            <ProductGrid products={related} />
          </section>
        )}
      </div>

      {/* vaste koopbalk op mobiel */}
      <div data-buybar className="fixed inset-x-0 bottom-0 z-50 border-t border-rule bg-sheet/95 shadow-[0_-8px_24px_-12px_rgb(10_26_51/0.35)] backdrop-blur lg:hidden">
        <div className="container-x flex items-center justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-[0.88rem] font-semibold text-ink">{p.name}</p>
            <p className="price text-[1.05rem]">
              {variants.length > 0 && <span className="text-[0.8rem] font-normal text-muted">vanaf </span>}
              {money(p.price)}
            </p>
          </div>
          {variants.length > 0 ? (
            <a href="#kopen" className="btn-accent btn-sm min-h-11 shrink-0">
              Kies optie
            </a>
          ) : (
            <AddToCartButton productId={p.id} disabled={!available} label={available ? "In winkelwagen" : "Uitverkocht"} className="btn-accent btn-sm min-h-11 shrink-0" />
          )}
        </div>
      </div>
    </>
  );
}
