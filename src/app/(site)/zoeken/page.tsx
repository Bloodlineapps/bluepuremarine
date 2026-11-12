import type { Metadata } from "next";
import { Icon } from "@/components/Icon";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { JsonLd } from "@/components/site/JsonLd";
import { ProductListing, loadListing, parseListing, type SP } from "@/components/site/listing";
import { CategoryTile } from "@/components/site/ui";
import { breadcrumbLd, graph, withBrand } from "@/lib/seo";
import { categoryTree } from "@/lib/shop";

// Zoekresultaten (/zoeken/?q=…). Nooit in de index (noindex,follow; ook geblokkeerd in robots.txt). Zelfde lijst,
// filters en paginering als een categorie; zonder resultaten tonen we de categorieën als suggestie.

type Props = { searchParams: Promise<SP> };
const crumbs = [{ name: "Zoeken", path: "/zoeken/" }];

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = parseListing(await searchParams);
  return { title: { absolute: withBrand(q ? `Zoekresultaten voor "${q}"` : "Zoeken in de webshop") }, robots: { index: false, follow: true } };
}

function SearchBox({ q }: { q: string }) {
  return (
    <form action="/zoeken/" method="get" role="search" className="relative mt-5 max-w-xl">
      <label htmlFor="page-search" className="sr-only">
        Zoek in de webshop
      </label>
      <input id="page-search" type="search" name="q" required minLength={2} maxLength={80} defaultValue={q} placeholder="Waar ben je naar op zoek?" className="field h-13 rounded-full border-2 pr-14 pl-5" />
      <button type="submit" aria-label="Zoeken" className="absolute top-1/2 right-1.5 grid h-10 w-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-brand text-white hover:bg-brand-600">
        <Icon name="search" className="h-5 w-5" strokeWidth={2.2} />
      </button>
    </form>
  );
}

async function Suggestions({ title }: { title: string }) {
  const tree = await categoryTree();
  if (!tree.length) return null;
  return (
    <section className="mt-10" aria-labelledby="zoek-suggesties">
      <h2 id="zoek-suggesties" className="mb-4 text-[length:var(--text-title)]">
        {title}
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
        {tree.map((c) => (
          <li key={c.id}>
            <CategoryTile tile={{ path: c.path, name: c.navTitle, count: c.count, image: c.image, highlight: c.highlight }} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const { q } = parseListing(sp);
  const listing = q.length >= 2 ? await loadListing("/zoeken/", sp, { q }) : null;
  const total = listing?.result.total ?? 0;
  const none = !!listing && total === 0 && !listing.state.filtered;

  return (
    <>
      <JsonLd data={graph(breadcrumbLd(crumbs))} />
      <div className="border-b border-rule bg-paper">
        <div className="container-x py-6 lg:py-8">
          <Breadcrumbs items={crumbs} />
          <h1 className="h-display mt-3 text-[length:var(--text-hero)] text-navy">{q ? `Zoekresultaten voor “${q}”` : "Zoeken"}</h1>
          {listing && (
            <p className="mt-3 text-[length:var(--text-lede)]" role="status">
              {total} {total === 1 ? "resultaat" : "resultaten"} voor “{q}”
            </p>
          )}
          <SearchBox q={q} />
        </div>
      </div>
      <div className="container-x pt-6 lg:pt-8">
        {!listing ? (
          <>
            <p>{q ? "Gebruik minimaal twee tekens om te zoeken." : "Zoek op productnaam, merk, productsoort of artikelnummer."}</p>
            <Suggestions title="Of kies een categorie" />
          </>
        ) : none ? (
          <>
            <div className="rounded-card border border-rule bg-paper p-6">
              <p className="text-[1.1rem] font-bold text-ink">Geen producten gevonden voor “{q}”</p>
              <ul className="prose-bp mt-2">
                <li>Controleer de spelling of probeer een korter zoekwoord</li>
                <li>Zoek op merk (bijvoorbeeld Harken of Vetus) of op productsoort</li>
                <li>Kom je er niet uit? Stuur ons een bericht, dan zoeken we met je mee</li>
              </ul>
            </div>
            <Suggestions title="Verder zoeken in een categorie" />
          </>
        ) : (
          <ProductListing base="/zoeken/" listing={listing} title="Gevonden producten" />
        )}
      </div>
    </>
  );
}
