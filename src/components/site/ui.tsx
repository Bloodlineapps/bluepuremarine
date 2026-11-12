import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { formatDate } from "@/lib/text";
import { Stars } from "./ReviewBadge";
import { Wave } from "./icons";

// Kleine bouwstenen die op meerdere pagina's terugkomen: sectiekop, categorietegel, reviewkaart en blogkaart.

/** Sectiekop: klein label, bannerkop (H2) en rechts een link naar het hele overzicht. */
export function SectionHeading({ eyebrow, title, href, linkLabel, id, className = "" }: { eyebrow?: string; title: string; href?: string; linkLabel?: string; id?: string; className?: string }) {
  return (
    <div className={`mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 ${className}`}>
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 id={id} className="h-display mt-1 text-[length:var(--text-section)] text-navy">
          {title}
        </h2>
      </div>
      {href && linkLabel && (
        <Link href={href} className="underline-grow inline-flex min-h-10 items-center gap-1.5 font-bold text-brand hover:text-aqua-600">
          {linkLabel}
          <Icon name="arrow" className="h-4 w-4" strokeWidth={2.2} />
        </Link>
      )}
    </div>
  );
}

export type Tile = { path: string; name: string; count?: number; image?: string | null; imageAlt?: string; highlight?: boolean };

/** Categorietegel: beeld (of een kleurvlak met golf), naam en aantal producten. Komt omhoog bij hover. */
export function CategoryTile({ tile, sizes = "(min-width: 1024px) 16vw, (min-width: 640px) 30vw, 46vw" }: { tile: Tile; sizes?: string }) {
  return (
    <Link href={tile.path} className="card card-hover group flex h-full flex-col overflow-hidden">
      <span className={`relative block aspect-[4/3] overflow-hidden ${tile.highlight ? "bg-linear-to-br from-coral-700 to-coral" : "bg-linear-to-br from-navy to-brand"}`}>
        {tile.image ? <Image src={tile.image} alt="" width={800} height={600} sizes={sizes} className="absolute inset-0 h-full w-full zoom-img object-cover" /> : <Wave className="zoom-img absolute inset-x-0 bottom-0 h-1/2 w-full text-white/15" />}
      </span>
      <span className="flex flex-1 items-center justify-between gap-2 p-3 sm:p-4">
        <span className="min-w-0">
          <span className="block leading-snug font-bold hyphens-auto text-ink group-hover:text-brand">{tile.name}</span>
          {tile.count != null && (
            <span className="text-[0.82rem] text-muted">
              {tile.count} {tile.count === 1 ? "product" : "producten"}
            </span>
          )}
        </span>
        <Icon name="arrow" className="hidden h-5 w-5 shrink-0 text-brand transition-transform duration-300 group-hover:translate-x-1 min-[400px]:block" strokeWidth={2.2} />
      </span>
    </Link>
  );
}

export type ReviewRow = { id: string; name: string; rating: number; title: string; text: string; date: Date; verified: boolean; product?: { name: string; path: string } | null };

/** Eén goedgekeurde review: sterren, titel, tekst, naam en datum; optioneel met link naar het product. */
export function ReviewCard({ review: r, showProduct = false }: { review: ReviewRow; showProduct?: boolean }) {
  return (
    <article className="card flex h-full flex-col p-5">
      <Stars rating={r.rating} className="text-[1.1rem]" label={`${r.rating} van 5 sterren`} />
      {r.title && <h3 className="mt-3 text-[1.05rem]">{r.title}</h3>}
      <p className="mt-2 flex-1 text-[0.95rem] whitespace-pre-line">{r.text}</p>
      <p className="mt-4 border-t border-rule pt-3 text-[0.86rem] text-muted">
        <span className="font-bold text-ink">{r.name}</span>
        {r.verified && <span className="badge-stock ml-2">Geverifieerde koper</span>}
        <span className="mt-0.5 block">
          <time dateTime={r.date.toISOString().slice(0, 10)}>{formatDate(r.date)}</time>
          {showProduct && r.product && (
            <>
              {" · over "}
              <Link href={r.product.path} className="link">
                {r.product.name}
              </Link>
            </>
          )}
        </span>
      </p>
    </article>
  );
}

export type PostRow = { path: string; title: string; excerpt: string; image: string | null; imageAlt: string; publishedAt: Date; category?: { name: string } | null };

/** Blogkaart voor overzichten. De kop is een H3 (zet er een H2 boven) of H2 op het blogoverzicht. */
export function PostCard({ post: p, as: Tag = "h3", priority = false }: { post: PostRow; as?: "h2" | "h3"; priority?: boolean }) {
  return (
    <article className="card card-hover group relative flex h-full flex-col overflow-hidden">
      <div className="relative aspect-[16/9] overflow-hidden bg-linear-to-br from-navy to-brand">
        {p.image ? <Image src={p.image} alt={p.imageAlt} width={1280} height={720} sizes="(min-width: 1024px) 30vw, (min-width: 640px) 46vw, 94vw" priority={priority} className="absolute inset-0 h-full w-full zoom-img object-cover" /> : <Wave className="absolute inset-x-0 bottom-0 h-1/2 w-full text-white/15" />}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[0.82rem] text-muted">
          {p.category && <span className="font-bold tracking-[0.08em] text-brand uppercase">{p.category.name} · </span>}
          <time dateTime={p.publishedAt.toISOString().slice(0, 10)}>{formatDate(p.publishedAt)}</time>
        </p>
        <Tag className="mt-2 text-[1.15rem] leading-snug">
          <Link href={p.path} className="after:absolute after:inset-0 after:content-[''] hover:text-brand">
            {p.title}
          </Link>
        </Tag>
        {p.excerpt && <p className="mt-2 line-clamp-3 text-[0.94rem]">{p.excerpt}</p>}
        <span className="mt-auto inline-flex items-center gap-1.5 pt-4 font-bold text-brand" aria-hidden="true">
          Lees het artikel
          <Icon name="arrow" className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={2.2} />
        </span>
      </div>
    </article>
  );
}

/** Uitklapblok (details) in de stijl van de FAQ en het productaccordeon. */
export function Accordion({ title, children, open = false, id, level = "h2" }: { title: string; children: React.ReactNode; open?: boolean; id?: string; level?: "h2" | "h3" }) {
  const H = level;
  return (
    <details id={id} open={open} className="faq-item scroll-mt-4 border-b border-rule">
      <summary className="flex min-h-14 items-center justify-between gap-6 py-4 text-ink hover:text-brand">
        <H className="text-[1.08rem] leading-snug text-[color:inherit]">{title}</H>
        <span className="faq-sign grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-50 text-brand" aria-hidden="true">
          <Icon name="plus" className="h-4 w-4" strokeWidth={2.4} />
        </span>
      </summary>
      <div className="pb-6">{children}</div>
    </details>
  );
}
