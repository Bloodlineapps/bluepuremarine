import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { pagePaths } from "@/lib/content";
import { getHome, type HeroBlock, type HeroTheme } from "@/lib/home";
import { money, moneyParts } from "@/lib/money";
import { graph, webPageLd } from "@/lib/seo";
import { getShop, getSite } from "@/lib/settings";
import { approvedReviews, brandsWithProducts, categoryTree, imagesOf, latestPosts, productBySlug, productsFor, reviewSummary } from "@/lib/shop";
import { ExternalLink } from "./ExternalLink";
import { Html } from "./Html";
import { JsonLd } from "./JsonLd";
import { ProductGrid } from "./ProductCard";
import { Stars } from "./ReviewBadge";
import { TruckIcon, Wave, WhatsAppIcon } from "./icons";
import { CategoryTile, PostCard, ReviewCard, SectionHeading, type Tile } from "./ui";

// Homepage in de opbouw van een watersportwebshop: drie actieblokken (één groot links, twee gestapeld rechts),
// daaronder de H1 met inleiding, categorietegels, bestsellers, de eigen reinigingslijn, merken, reviews, over ons,
// persoonlijk advies en de laatste blogs. De actieblokken en teksten komen uit /admin/instellingen/homepage/.

const THEME: Record<HeroTheme, { bg: string; veil: string; eyebrow: string; text: string; btn: string }> = {
  navy: { bg: "bg-linear-to-br from-navy-900 via-navy to-navy-600 text-white", veil: "bg-linear-to-r from-navy-900 via-navy/85 to-navy/20", eyebrow: "text-aqua", text: "text-night-ink", btn: "btn-light" },
  blue: { bg: "bg-linear-to-br from-brand-700 via-brand to-brand-600 text-white", veil: "bg-linear-to-r from-brand-700 via-brand/85 to-brand/25", eyebrow: "text-aqua-100", text: "text-white", btn: "btn-light" },
  aqua: { bg: "bg-linear-to-br from-aqua to-aqua-100 text-navy", veil: "bg-linear-to-r from-aqua-100 via-aqua-100/85 to-aqua/25", eyebrow: "text-navy-700", text: "text-navy-800", btn: "btn-primary" },
  coral: { bg: "bg-linear-to-br from-[#9f2812] via-[#c2331b] to-coral-600 text-white", veil: "bg-linear-to-r from-[#9f2812] via-[#c2331b]/85 to-coral-600/25", eyebrow: "text-sun-100", text: "text-white", btn: "btn-light" },
};

type HeroProduct = { name: string; price: number; images: string } | null;

/**
 * Actieblok. De eigen afbeelding (b.image) vult het hele blok als achtergrond, met een verloop in de themakleur
 * eroverheen zodat de tekst leesbaar blijft. De productfoto (vrijstaand op wit) staat in een witte ronde schijf,
 * met het schuine prijsblok eroverheen.
 */
function Hero({ block: b, product, big = false }: { block: HeroBlock; product: HeroProduct; big?: boolean }) {
  const t = THEME[b.theme] ?? THEME.navy;
  const own = product ? imagesOf(product)[0] : undefined;
  const price = b.priceLabel && product ? moneyParts(product.price) : null;
  const side = !!own || !!price;
  return (
    <Link href={b.href || "/"} className={`group shine isolate flex rounded-card ${t.bg} ${big ? "min-h-[22rem] flex-col sm:min-h-[24rem] sm:flex-row lg:row-span-2 lg:min-h-0" : "min-h-[12.5rem] lg:min-h-0"}`}>
      {b.image ? (
        <>
          <Image src={b.image} alt={own ? "" : b.imageAlt} width={1200} height={900} priority={big} sizes={big ? "(min-width: 1024px) 60vw, 94vw" : "(min-width: 1024px) 32vw, 94vw"} className="absolute inset-0 h-full w-full zoom-img -z-20 object-cover" />
          <span className={`pointer-events-none absolute inset-0 -z-10 ${t.veil}`} aria-hidden="true" />
        </>
      ) : (
        <>
          <span className="pointer-events-none absolute -top-24 -right-20 -z-10 h-72 w-72 rounded-full bg-white/15 blur-3xl" aria-hidden="true" />
          <Wave className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-20 w-full text-white/10" />
        </>
      )}
      <span className={`flex min-w-0 flex-1 flex-col items-start justify-center ${big ? `p-6 sm:p-9 lg:p-11 ${side ? "pb-2 sm:pr-[18rem] lg:pr-[14.5rem] xl:pr-[19.5rem]" : ""}` : `p-5 sm:p-6 ${side ? "pr-[8.5rem] sm:pr-[10.5rem] lg:pr-[8.5rem] xl:pr-[10.5rem]" : ""}`}`}>
        {b.eyebrow && <span className={`eyebrow ${t.eyebrow}`}>{b.eyebrow}</span>}
        <span className={`h-display mt-2 block ${big ? "text-[clamp(2.4rem,-0.6rem+5.2vw,4.25rem)]" : "text-[clamp(1.5rem,0.7rem+1.4vw,2.1rem)]"}`}>
          {b.title.split("\n").map((line, i) => (
            <span key={i} className="block text-balance">
              {line}
            </span>
          ))}
        </span>
        {b.text && <span className={`mt-3 block ${big ? "max-w-[34ch] text-[length:var(--text-lede)]" : "max-w-[30ch] text-[0.92rem] leading-snug"} ${t.text}`}>{b.text}</span>}
        {b.cta && (
          <span className={`${t.btn} ${big ? "btn-lg mt-6" : "btn-sm mt-4 min-h-10 px-3 whitespace-nowrap"}`}>
            {b.cta}
            <Icon name="arrow" className="h-4 w-4 shrink-0" strokeWidth={2.4} />
          </span>
        )}
      </span>
      {side && (
        <span className={big ? "relative mx-auto mt-2 mb-7 block h-52 w-52 shrink-0 sm:absolute sm:top-1/2 sm:right-8 sm:m-0 sm:h-60 sm:w-60 sm:-translate-y-1/2 lg:right-6 lg:h-44 lg:w-44 xl:right-10 xl:h-[16.5rem] xl:w-[16.5rem]" : "absolute top-1/2 right-4 block h-28 w-28 -translate-y-1/2 sm:right-5 sm:h-36 sm:w-36 lg:h-28 lg:w-28 xl:h-36 xl:w-36"}>
          {own && (
            <span className="hero-disc">
              <Image src={own.src} alt={own.alt || product?.name || ""} width={528} height={528} priority={big} sizes={big ? "(min-width: 1024px) 264px, 240px" : "144px"} className="absolute inset-0 h-full w-full zoom-img object-contain p-[5%] mix-blend-multiply" />
            </span>
          )}
          {price && (
            <span className={`absolute z-10 ${big ? "-bottom-4 -left-4 sm:-left-5" : "-right-1 -bottom-3 sm:-bottom-4"}`}>
              <span className="price-tag">
                <span className={`leading-none font-extrabold tracking-[0.12em] uppercase ${big ? "text-[0.72rem]" : "text-[0.6rem]"}`}>{b.priceLabel}</span>
                <span className={`h-display leading-none ${big ? "text-[2.4rem] xl:text-[3rem]" : "text-[1.7rem]"}`}>
                  <span className="sr-only">€ </span>
                  {price.euros}
                  <span className="align-top text-[0.5em]">,{price.cents}</span>
                </span>
              </span>
            </span>
          )}
        </span>
      )}
    </Link>
  );
}

function Why({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <li className="card flex gap-4 p-5">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-aqua-100 text-brand">{icon}</span>
      <div>
        <h3 className="text-[1.05rem]">{title}</h3>
        <p className="mt-1 text-[0.94rem]">{children}</p>
      </div>
    </li>
  );
}

export async function HomeView() {
  const [home, shop, site, tree, featured, brands, reviews, summary, posts, paths] = await Promise.all([getHome(), getShop(), getSite(), categoryTree(), productsFor("featured", 8), brandsWithProducts(), approvedReviews(undefined, 6), reviewSummary(), latestPosts(3), pagePaths()]);
  const heroProducts = await Promise.all(home.hero.map((b) => (b.productSlug ? productBySlug(b.productSlug) : null)));

  // tegels: de hoofdcategorieën, aangevuld met de subcategorieën met de meeste producten
  const mains: Tile[] = tree.map((c) => ({ path: c.path, name: c.navTitle, count: c.count, image: c.image, imageAlt: c.imageAlt, highlight: c.highlight }));
  const subs: Tile[] = tree
    .flatMap((c) => c.children)
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map((c) => ({ path: c.path, name: c.navTitle, count: c.count, image: c.image, imageAlt: c.imageAlt }));
  const cleaning = tree.flatMap((c) => c.children).find((c) => c.path === "/onderhoud/reinigingsproducten/") ?? tree.find((c) => c.path === "/onderhoud/");
  const waHref = site.whatsapp ? `https://wa.me/${site.whatsapp.replace(/\D/g, "")}${site.whatsappText ? `?text=${encodeURIComponent(site.whatsappText)}` : ""}` : null;
  const marquee = brands.length >= 6;

  const brandItem = (b: (typeof brands)[number], hidden = false) => (
    <li key={`${b.id}${hidden ? "-kopie" : ""}`} aria-hidden={hidden || undefined} className="shrink-0">
      <Link href={`/merken/${b.slug}/`} tabIndex={hidden ? -1 : undefined} className="card card-hover flex h-20 w-40 items-center justify-center px-5" aria-label={`Producten van ${b.name}`}>
        {b.logo ? <Image src={b.logo} alt={`Logo van ${b.name}`} width={120} height={48} unoptimized={b.logo.endsWith(".svg")} className="h-auto max-h-12 w-auto object-contain" /> : <span className="h-display text-center text-[1.25rem] text-navy">{b.name}</span>}
      </Link>
    </li>
  );

  return (
    <>
      <JsonLd data={graph(webPageLd({ path: "/", title: home.heading, description: home.intro, image: home.hero[0].image || null }))} />

      {/* actieblokken: 1 groot links, 2 gestapeld rechts */}
      <section aria-label="Acties en uitgelichte categorieën" className="container-x pt-4 lg:pt-6">
        <div className="grid gap-4 lg:h-[34rem] lg:grid-cols-[1.55fr_1fr] lg:grid-rows-2 xl:grid-cols-[1.8fr_1fr]">
          <Hero block={home.hero[0]} product={heroProducts[0]} big />
          <Hero block={home.hero[1]} product={heroProducts[1]} />
          <Hero block={home.hero[2]} product={heroProducts[2]} />
        </div>
      </section>

      {/* H1 + inleiding */}
      <section className="container-x pt-[var(--spacing-section-sm)]">
        <h1 className="max-w-[26ch] text-[length:var(--text-section)]">{home.heading}</h1>
        {home.intro && <p className="mt-3 max-w-[70ch] text-[length:var(--text-lede)]">{home.intro}</p>}
      </section>

      {/* categorieën */}
      <section className="container-x pt-[var(--spacing-section-sm)]" aria-labelledby="home-categorieen">
        <SectionHeading id="home-categorieen" eyebrow="Assortiment" title="Shop per categorie" />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
          {mains.map((t) => (
            <li key={t.path}>
              <CategoryTile tile={t} />
            </li>
          ))}
        </ul>
        {subs.length > 0 && (
          <>
            <h3 className="mt-8 mb-3 text-[1.05rem]">Populaire subcategorieën</h3>
            <ul className="flex flex-wrap gap-2">
              {subs.map((t) => (
                <li key={t.path}>
                  <Link href={t.path} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-rule bg-sheet px-4 font-semibold text-ink transition-all duration-200 hover:-translate-y-0.5 hover:border-brand hover:text-brand hover:shadow-card">
                    {t.name}
                    <span className="text-[0.8rem] font-normal text-muted tabular-nums">{t.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* bestsellers */}
      {featured.length > 0 && (
        <section className="reveal container-x pt-[var(--spacing-section)]" aria-labelledby="home-populair">
          <SectionHeading id="home-populair" eyebrow="Bestsellers" title="Populair aan boord" href="/bestsellers/" linkLabel="Bekijk alle bestsellers" />
          <ProductGrid products={featured.length >= 8 ? featured.slice(0, 8) : featured.slice(0, 4)} className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" />
        </section>
      )}

      {/* eigen merk */}
      <section className="reveal on-dark relative isolate mt-[var(--spacing-section)] overflow-hidden bg-navy text-night-ink" aria-labelledby="home-bluepure">
        <Wave className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-28 w-full text-brand/40" />
        <div className="container-x grid items-center gap-8 py-[var(--spacing-section)] lg:grid-cols-2 lg:gap-14">
          <div>
            <p className="eyebrow text-aqua">Eigen merk</p>
            <h2 id="home-bluepure" className="h-display mt-2 text-[length:var(--text-hero)] text-white">
              BluePure reinigingslijn
            </h2>
            <p className="mt-4 max-w-[58ch] text-[length:var(--text-lede)] text-night-muted">
              Onze eigen reinigers komen voort uit jarenlange ervaring met het professioneel schoonmaken van boten en jachten. Voor romp en dek, voor de kajuit en voor de schroef is er een middel dat doet wat het moet doen. Alle producten zijn getest in zout water, in de volle zon en bij dagelijks gebruik.
            </p>
            <ul className="mt-5 space-y-2 text-night-ink">
              {["Reinigers voor exterieur, interieur en schroef", "Ook als voordelige 5 liter-verpakking en als compleet pakket", "Advies nodig? Wij vertellen je welk middel bij jouw boot past"].map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <Icon name="check" className="mt-1 h-5 w-5 shrink-0 text-aqua" strokeWidth={2.6} />
                  {line}
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href={cleaning?.path ?? "/onderhoud/"} className="btn-accent btn-lg shine">
                Shop de reinigingsproducten
                <Icon name="arrow" className="h-5 w-5" strokeWidth={2.4} />
              </Link>
              <Link href="/pakketten/" className="btn-light btn-lg">
                Bekijk pakketten en deals
              </Link>
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-card">
            <Image src="/uploads/home/jacht.webp" alt="Schone kuip en kajuit van een motorjacht" width={1200} height={900} sizes="(min-width: 1024px) 44vw, 92vw" className="absolute inset-0 h-full w-full object-cover" />
          </div>
        </div>
      </section>

      {/* waarom BluePure Marine */}
      <section className="reveal container-x pt-[var(--spacing-section)]" aria-labelledby="home-waarom">
        <SectionHeading id="home-waarom" eyebrow="Zo werken wij" title="Bestellen bij BluePure Marine" />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {shop.deliveryNote && (
            <Why icon={<TruckIcon className="h-6 w-6" />} title="Snel onderweg">
              {shop.deliveryNote}. Zo ligt je bestelling snel aan boord en hoef je niet te wachten met je klus.
            </Why>
          )}
          {shop.freeShippingFrom > 0 && (
            <Why icon={<Icon name="euro" className="h-6 w-6" />} title="Gratis verzending">
              Bij een bestelling vanaf {money(shop.freeShippingFrom)} betaal je geen verzendkosten. Onder dat bedrag zie je de kosten direct in je winkelwagen.
            </Why>
          )}
          {shop.returnDays > 0 && (
            <Why icon={<Icon name="rotate" className="h-6 w-6" />} title={`${shop.returnDays} dagen bedenktijd`}>
              Past een onderdeel toch niet of heb je je bedacht? Je hebt {shop.returnDays} dagen de tijd om je bestelling terug te sturen.
            </Why>
          )}
          <Why icon={<Icon name="shield" className="h-6 w-6" />} title="Veilig betalen">
            Je rekent af in een beveiligde omgeving met de betaalmethode die je gewend bent, zoals iDEAL of creditcard.
          </Why>
        </ul>
      </section>

      {/* merken */}
      {brands.length > 0 && (
        <section className="reveal pt-[var(--spacing-section)]" aria-labelledby="home-merken">
          <div className="container-x">
            <SectionHeading id="home-merken" eyebrow="Merken" title="Merken die je kunt vertrouwen" href="/merken/" linkLabel="Bekijk alle merken" />
          </div>
          {marquee ? (
            <div className="marquee overflow-hidden py-2">
              <ul className="flex w-max animate-marquee gap-4 pl-4">
                {brands.map((b) => brandItem(b))}
                {brands.map((b) => brandItem(b, true))}
              </ul>
            </div>
          ) : (
            <ul className="container-x flex flex-wrap gap-4">{brands.map((b) => brandItem(b))}</ul>
          )}
        </section>
      )}

      {/* reviews */}
      {reviews.length > 0 && (
        <section id="reviews" className="reveal mt-[var(--spacing-section)] scroll-mt-4 bg-paper py-[var(--spacing-section)]" aria-labelledby="home-reviews">
          <div className="container-x">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
              <div>
                <p className="eyebrow">Reviews</p>
                <h2 id="home-reviews" className="h-display mt-1 text-[length:var(--text-section)] text-navy">
                  Dit zeggen onze klanten
                </h2>
              </div>
              {summary.count > 0 && (
                <p className="flex items-center gap-3">
                  <Stars rating={summary.average} className="text-[1.5rem]" />
                  <span>
                    <span className="text-[1.4rem] font-extrabold text-ink">{summary.average.toLocaleString("nl-NL", { minimumFractionDigits: 1 })}</span>
                    <span className="text-muted"> / 5 · {summary.count} {summary.count === 1 ? "review" : "reviews"}</span>
                  </span>
                </p>
              )}
            </div>
            <ul className="grid gap-4 max-sm:[&>li:nth-child(n+4)]:hidden sm:grid-cols-2 lg:grid-cols-3">
              {reviews.map((r) => (
                <li key={r.id}>
                  <ReviewCard review={r} showProduct />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* over ons */}
      <section className="reveal container-x pt-[var(--spacing-section)]" aria-labelledby="home-over">
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
          <div className="group relative aspect-[4/3] overflow-hidden rounded-card">
            <Image src="/uploads/home/kajuit.webp" alt="Zeiljacht op het water bij zonsondergang" width={1200} height={900} sizes="(min-width: 1024px) 44vw, 92vw" className="absolute inset-0 h-full w-full object-cover" />
          </div>
          <div>
            <p className="eyebrow">Over BluePure Marine</p>
            <h2 id="home-over" className="h-display mt-1 text-[length:var(--text-section)] text-navy">
              {home.aboutTitle}
            </h2>
            <p className="mt-4 whitespace-pre-line">{home.aboutText}</p>
            {paths["over-ons"] && (
              <Link href={paths["over-ons"]} className="btn-secondary mt-6">
                Meer over BluePure Marine
                <Icon name="arrow" className="h-4 w-4" strokeWidth={2.2} />
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* persoonlijk advies */}
      <section className="reveal container-x pt-[var(--spacing-section)]" aria-labelledby="home-advies">
        <div className="relative isolate overflow-hidden rounded-card bg-linear-to-br from-brand-700 via-brand to-brand-600 p-6 text-white sm:p-10">
          <Wave className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-24 w-full text-white/10" />
          <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <p className="eyebrow text-aqua-100">Persoonlijk advies</p>
              <h2 id="home-advies" className="h-display mt-1 text-[length:var(--text-section)] text-white">
                Twijfel je? Vraag het ons
              </h2>
              <p className="mt-3 max-w-[56ch] text-white/90">
                Welke reiniger gebruik je op gelcoat, welke boegschroef past in jouw tunnel en welk blok hoort bij jouw schoot? Stuur ons een bericht of bel even. Je krijgt persoonlijk antwoord van ons team, dat jarenlange ervaring heeft met het onderhoud van boten en jachten, zodat je in één keer het juiste bestelt.
              </p>
            </div>
            <ul className="grid gap-3">
              {site.phone && (
                <li>
                  <a href={`tel:${site.phoneIntl || site.phone.replace(/[^+\d]/g, "")}`} className="btn-light w-full justify-start text-left">
                    <Icon name="phone" className="h-5 w-5 shrink-0 text-brand" />
                    Bel {site.phone}
                  </a>
                </li>
              )}
              {waHref && (
                <li>
                  <ExternalLink href={waHref} className="btn-light w-full justify-start text-left">
                    <WhatsAppIcon className="h-5 w-5 shrink-0 text-success" />
                    Stuur een WhatsApp-bericht
                  </ExternalLink>
                </li>
              )}
              {site.email && (
                <li>
                  <a href={`mailto:${site.email}`} className="btn-light w-full justify-start text-left break-all">
                    <Icon name="mail" className="h-5 w-5 shrink-0 text-brand" />
                    Mail naar {site.email}
                  </a>
                </li>
              )}
              {paths.contact && (
                <li>
                  <Link href={paths.contact} className="underline-grow inline-flex min-h-10 items-center gap-1.5 font-bold text-white">
                    Naar de contactpagina
                    <Icon name="arrow" className="h-4 w-4" strokeWidth={2.2} />
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </div>
      </section>

      {/* blog */}
      {posts.length > 0 && (
        <section className="reveal container-x pt-[var(--spacing-section)]" aria-labelledby="home-blog">
          <SectionHeading id="home-blog" eyebrow="Blog" title="Tips voor onderhoud en techniek" href="/blog/" linkLabel="Alle blogartikelen" />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <li key={p.path}>
                <PostCard post={p} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* SEO-tekst */}
      {home.seoText && (
        <section className="container-x pt-[var(--spacing-section)]">
          <Html html={home.seoText} className="max-w-[80ch]" />
        </section>
      )}
    </>
  );
}
