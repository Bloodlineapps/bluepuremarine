import type { Metadata } from "next";
import { categoryCrumbs } from "@/lib/crumbs";
import { breadcrumbLd, buildMetadata, graph, itemListLd, seoDescription, shopTails, titleFor } from "@/lib/seo";
import { getShop } from "@/lib/settings";
import { categoryByPath, categoryTree } from "@/lib/shop";
import { plain } from "@/lib/text";
import { Breadcrumbs } from "./Breadcrumbs";
import { Html } from "./Html";
import { JsonLd } from "./JsonLd";
import { ProductListing, loadListing, parseListing, type SP } from "./listing";
import { CategoryTile } from "./ui";

// Categoriepagina (hoofd- en subcategorie): kruimelpad, H1, inleiding, bij een hoofdcategorie tegels van de
// subcategorieën, daarna de productlijst met filters, sortering en paginering en onderaan de SEO-tekst.
// Een hoofdcategorie toont haar eigen producten plus die van alle subcategorieën.

export type CategoryRow = NonNullable<Awaited<ReturnType<typeof categoryByPath>>>;

export async function categoryMetadata(cat: CategoryRow, sp: SP): Promise<Metadata> {
  const s = parseListing(sp);
  const shop = await getShop();
  const name = cat.name;
  return buildMetadata({
    title: titleFor(cat.metaTitle, name, [" kopen", " voor je boot", " online bestellen"], s.page),
    description: seoDescription(cat.metaDescription || cat.intro || plain(cat.description) || `${name} koop je bij BluePure Marine.`, shopTails(shop), s.page),
    path: cat.path,
    image: cat.image,
    page: s.page,
    filtered: s.filtered,
    noindex: cat.noindex,
  });
}

export async function CategoryView({ category: cat, searchParams }: { category: CategoryRow; searchParams: SP }) {
  const ids = [cat.id, ...cat.children.map((c) => c.id)];
  const [listing, tree] = await Promise.all([loadListing(cat.path, searchParams, { categoryIds: ids }), categoryTree()]);
  const crumbs = categoryCrumbs(cat);
  const node = tree.find((n) => n.id === cat.id);
  const first = listing.state.page === 1 && !listing.state.filtered;

  return (
    <>
      <JsonLd
        data={graph(
          breadcrumbLd(crumbs),
          itemListLd(
            cat.name,
            listing.result.items.map((p) => ({ name: p.name, path: p.path })),
          ),
        )}
      />
      <div className="border-b border-rule bg-paper">
        <div className="container-x py-6 lg:py-8">
          <Breadcrumbs items={crumbs} />
          <h1 className="h-display mt-3 text-[length:var(--text-hero)] text-navy">{cat.name}</h1>
          {cat.intro && <p className="mt-3 max-w-[75ch] text-[length:var(--text-lede)]">{cat.intro}</p>}
        </div>
      </div>

      <div className="container-x pt-6 lg:pt-8">
        {node && node.children.length > 0 && (
          <nav aria-label={`Subcategorieën van ${cat.name}`} className="mb-8">
            <h2 className="mb-3 text-[1.15rem]">Kies een subcategorie</h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
              {node.children.map((c) => (
                <li key={c.id}>
                  <CategoryTile tile={{ path: c.path, name: c.navTitle, count: c.count, image: c.image, imageAlt: c.imageAlt }} />
                </li>
              ))}
            </ul>
          </nav>
        )}

        <ProductListing base={cat.path} listing={listing} title={`Producten in ${cat.navTitle || cat.name}`} />

        {first && cat.description && (
          <section className="mt-[var(--spacing-section)] border-t border-rule pt-8">
            <Html html={cat.description} className="max-w-[80ch]" />
          </section>
        )}
      </div>
    </>
  );
}
