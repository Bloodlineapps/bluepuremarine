import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { Html } from "@/components/site/Html";
import { JsonLd } from "@/components/site/JsonLd";
import { ProductListing, loadListing, parseListing, type SP } from "@/components/site/listing";
import { db } from "@/lib/db";
import { breadcrumbLd, buildMetadata, graph, itemListLd, notFoundMetadata, seoDescription, shopTails, titleFor } from "@/lib/seo";
import { getShop } from "@/lib/settings";
import { GENERIC_BRAND, brandBySlug } from "@/lib/shop";
import { plain } from "@/lib/text";

// Merkpagina: H1, omschrijving en alle producten van het merk met dezelfde filters, sortering en paginering als een
// categorie. De bekende merken zijn vooraf bekend (generateStaticParams); filters en paginering lezen de query.

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SP> };
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    return (await db.brand.findMany({ where: { slug: { not: GENERIC_BRAND } }, select: { slug: true } })).map((b) => ({ slug: b.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const brand = await brandBySlug((await params).slug);
  if (!brand || brand.slug === GENERIC_BRAND) return notFoundMetadata;
  const [s, shop] = [parseListing(await searchParams), await getShop()];
  return buildMetadata({
    title: titleFor(brand.metaTitle, brand.name, [" kopen", " – onderdelen en producten", " online"], s.page),
    description: seoDescription(brand.metaDescription || plain(brand.description) || `Producten van ${brand.name} koop je bij BluePure Marine.`, shopTails(shop), s.page),
    path: `/merken/${brand.slug}/`,
    image: brand.logo?.startsWith("/uploads/") ? brand.logo : null,
    page: s.page,
    filtered: s.filtered,
  });
}

export default async function BrandPage({ params, searchParams }: Props) {
  const brand = await brandBySlug((await params).slug);
  // het verzamelmerk "Overige merken" is geen merk en heeft dus geen pagina
  if (!brand || brand.slug === GENERIC_BRAND) notFound();
  const base = `/merken/${brand.slug}/`;
  const listing = await loadListing(base, await searchParams, { brandId: brand.id });
  // een merk zonder zichtbare producten heeft geen pagina
  if (listing.result.total === 0 && !listing.state.filtered) notFound();
  const crumbs = [
    { name: "Merken", path: "/merken/" },
    { name: brand.name, path: base },
  ];
  const first = listing.state.page === 1 && !listing.state.filtered;

  return (
    <>
      <JsonLd
        data={graph(
          breadcrumbLd(crumbs),
          itemListLd(
            `Producten van ${brand.name}`,
            listing.result.items.map((p) => ({ name: p.name, path: p.path })),
          ),
        )}
      />
      <div className="border-b border-rule bg-paper">
        <div className="container-x flex flex-wrap items-center justify-between gap-6 py-6 lg:py-8">
          <div>
            <Breadcrumbs items={crumbs} />
            <h1 className="h-display mt-3 text-[length:var(--text-hero)] text-navy">{brand.name}</h1>
            {!brand.description && <p className="mt-3 max-w-[70ch] text-[length:var(--text-lede)]">Alle producten van {brand.name} die je bij BluePure Marine kunt bestellen.</p>}
          </div>
          {brand.logo && (
            <span className="card grid h-24 w-44 shrink-0 place-items-center p-4">
              <Image src={brand.logo} alt={`Logo van ${brand.name}`} width={160} height={64} unoptimized={brand.logo.endsWith(".svg")} priority className="h-auto max-h-16 w-auto object-contain" />
            </span>
          )}
        </div>
      </div>
      <div className="container-x pt-6 lg:pt-8">
        {first && brand.description && <Html html={brand.description} className="mb-8 max-w-[80ch]" />}
        <ProductListing base={base} listing={listing} hideBrands title={`Producten van ${brand.name}`} />
        <p className="mt-10">
          <Link href="/merken/" className="underline-grow inline-flex min-h-10 items-center gap-1.5 font-bold text-brand">
            <Icon name="arrowLeft" className="h-4 w-4" strokeWidth={2.2} />
            Terug naar alle merken
          </Link>
        </p>
      </div>
    </>
  );
}
