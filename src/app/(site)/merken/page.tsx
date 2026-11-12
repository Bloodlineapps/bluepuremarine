import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { JsonLd } from "@/components/site/JsonLd";
import { breadcrumbLd, buildMetadata, graph, itemListLd, seoDescription, seoTitle, shopTails } from "@/lib/seo";
import { getShop } from "@/lib/settings";
import { brandsWithProducts } from "@/lib/shop";

// Merkenoverzicht: alle merken met producten in de webshop, met logo (of naam) en het aantal producten.
export const revalidate = 3600;
const crumbs = [{ name: "Merken", path: "/merken/" }];

export async function generateMetadata(): Promise<Metadata> {
  const [brands, shop] = await Promise.all([brandsWithProducts(), getShop()]);
  const names = brands.slice(0, 5).map((b) => b.name);
  return buildMetadata({
    title: seoTitle("Merken", [" voor boot en watersport", " – alle merken"]),
    description: seoDescription(`Alle merken bij BluePure Marine op een rij${names.length ? `, waaronder ${names.join(", ")}` : ""}. Kies een merk en bekijk het assortiment.`, shopTails(shop)),
    path: "/merken/",
  });
}

export default async function BrandsPage() {
  const brands = await brandsWithProducts();
  return (
    <>
      <JsonLd
        data={graph(
          breadcrumbLd(crumbs),
          itemListLd(
            "Merken bij BluePure Marine",
            brands.map((b) => ({ name: b.name, path: `/merken/${b.slug}/` })),
          ),
        )}
      />
      <div className="border-b border-rule bg-paper">
        <div className="container-x py-6 lg:py-8">
          <Breadcrumbs items={crumbs} />
          <h1 className="h-display mt-3 text-[length:var(--text-hero)] text-navy">Merken</h1>
          <p className="mt-3 max-w-[72ch] text-[length:var(--text-lede)]">
            Naast onze eigen BluePure reinigingslijn vind je bij ons onderdelen, elektronica en watersportartikelen van bekende merken. Kies een merk om alle producten van dat merk te bekijken.
          </p>
        </div>
      </div>
      <section className="container-x pt-8" aria-labelledby="merken-lijst">
        <h2 id="merken-lijst" className="mb-4 text-[1.15rem]">
          {brands.length} {brands.length === 1 ? "merk" : "merken"} in de webshop
        </h2>
        {brands.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {brands.map((b) => (
              <li key={b.id}>
                <Link href={`/merken/${b.slug}/`} className="card card-hover group flex h-full flex-col items-center gap-3 p-5 text-center">
                  <span className="grid h-20 w-full place-items-center overflow-hidden">
                    {b.logo ? <Image src={b.logo} alt="" width={160} height={64} unoptimized={b.logo.endsWith(".svg")} className="zoom-img h-auto max-h-16 w-auto object-contain" /> : <span className="h-display zoom-img text-[1.6rem] text-navy">{b.name}</span>}
                  </span>
                  <span>
                    <span className="block font-bold text-ink group-hover:text-brand">{b.name}</span>
                    <span className="text-[0.84rem] text-muted">
                      {b._count.products} {b._count.products === 1 ? "product" : "producten"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-card border border-rule bg-paper p-6">Er staan nog geen merken in de webshop.</p>
        )}
      </section>
    </>
  );
}
