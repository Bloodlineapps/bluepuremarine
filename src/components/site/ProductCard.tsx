import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { discountPct, money } from "@/lib/money";
import { imagesOf, inStock, realBrand, type ProductCardData } from "@/lib/shop";

/**
 * Productkaart voor overzichten: vierkante afbeelding op wit, merk, naam (link over de hele kaart), ondertitel,
 * prijs met eventuele van-prijs en kortingsbadge, voorraad en de knop "In winkelwagen" (bij varianten: "Kies optie").
 * De kaart komt omhoog en de afbeelding zoomt bij hover. Koppen zijn H3: zet er altijd een H2 boven.
 */
export function ProductCard({ product: p, priority = false, sizes = "(min-width: 1280px) 20vw, (min-width: 768px) 30vw, 46vw" }: { product: ProductCardData; priority?: boolean; sizes?: string }) {
  const image = imagesOf(p)[0];
  const available = inStock(p);
  const pct = discountPct(p.price, p.compareAtPrice);
  const hasVariants = p._count.variants > 0;
  const brand = realBrand(p.brand);
  return (
    <article className="card card-hover group relative flex h-full flex-col overflow-hidden">
      <div className="relative aspect-square overflow-hidden bg-white">
        {image ? (
          <Image src={image.src} alt={image.alt || p.name} width={600} height={600} sizes={sizes} priority={priority} className="absolute inset-0 h-full w-full zoom-img object-contain" />
        ) : (
          <span className="absolute inset-0 grid place-items-center bg-paper text-muted" aria-hidden="true">
            <Icon name="bag" className="h-10 w-10" />
          </span>
        )}
        <div className="pointer-events-none absolute top-2 left-2 flex flex-col items-start gap-1">
          {pct > 0 && <span className="badge-sale">-{pct}%</span>}
          {!available && <span className="badge-out">Uitverkocht</span>}
        </div>
      </div>
      <div className="flex flex-1 flex-col border-t border-rule p-3 sm:p-4">
        {brand && <p className="text-[0.74rem] font-bold tracking-[0.08em] text-muted uppercase">{brand.name}</p>}
        <h3 className="mt-0.5 line-clamp-3 text-[0.98rem] leading-snug font-semibold sm:text-[1.02rem]">
          <Link href={p.path} className="after:absolute after:inset-0 after:content-[''] hover:text-brand">
            {p.name}
          </Link>
        </h3>
        {p.subtitle && <p className="mt-1 line-clamp-2 text-[0.86rem] text-muted">{p.subtitle}</p>}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-2 gap-y-3 pt-3">
          <div>
            <p className="flex flex-wrap items-baseline gap-x-2">
              {hasVariants && <span className="text-[0.8rem] text-muted">vanaf</span>}
              <span className="price text-[1.2rem]">{money(p.price)}</span>
              {pct > 0 && p.compareAtPrice && (
                <span className="price-old">
                  <span className="sr-only">Van </span>
                  {money(p.compareAtPrice)}
                </span>
              )}
            </p>
            <p className={`mt-0.5 flex items-center gap-1.5 text-[0.82rem] font-semibold ${available ? "text-success" : "text-muted"}`}>
              <span className={`h-2 w-2 rounded-full ${available ? "bg-success" : "bg-muted"}`} aria-hidden="true" />
              {available ? "Op voorraad" : "Uitverkocht"}
            </p>
          </div>
          <div className="relative z-10 ml-auto">
            {hasVariants ? (
              <Link href={p.path} className="btn-secondary btn-sm min-h-11" aria-label={`Kies optie voor ${p.name}`}>
                Kies optie
              </Link>
            ) : (
              <AddToCartButton productId={p.id} disabled={!available} compact label={available ? `${p.name} in winkelwagen` : `${p.name} is uitverkocht`} />
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

/** Raster van productkaarten: 2 kolommen op mobiel, 3–4 op desktop. */
export function ProductGrid({ products, cols = 4, priorityCount = 0, className }: { products: ProductCardData[]; cols?: 3 | 4; priorityCount?: number; className?: string }) {
  return (
    <ul className={className ?? `grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 ${cols === 4 ? "xl:grid-cols-4" : ""}`}>
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
