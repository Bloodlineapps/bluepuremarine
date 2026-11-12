import Link from "next/link";
import { Icon } from "@/components/Icon";
import { NotFoundBeacon } from "@/components/site/NotFoundBeacon";
import { CategoryTile } from "@/components/site/ui";
import { dict } from "@/lib/i18n";
import { notFoundMetadata } from "@/lib/seo";
import { categoryTree } from "@/lib/shop";

// 404-pagina (echte 404-status, noindex): zoekveld en links naar de hoofdcategorieën. De beacon meldt het pad aan
// het 404-log in het beheer (/admin/redirects/).
export const metadata = notFoundMetadata;

export default async function NotFound() {
  const t = dict("nl").notFound;
  const tree = await categoryTree();
  return (
    <>
      <NotFoundBeacon />
      <section className="container-x py-[var(--spacing-section)]">
        <p className="eyebrow">{t.code}</p>
        <h1 className="h-display mt-2 max-w-[18ch] text-[length:var(--text-hero)] text-navy">{t.title}</h1>
        <p className="mt-4 max-w-[62ch] text-[length:var(--text-lede)]">{t.text}</p>

        <form action="/zoeken/" method="get" role="search" className="relative mt-7 max-w-xl">
          <label htmlFor="nf-search" className="sr-only">
            Zoek in de webshop
          </label>
          <input id="nf-search" type="search" name="q" required minLength={2} maxLength={80} placeholder="Waar ben je naar op zoek?" className="field h-13 rounded-full border-2 pr-14 pl-5" />
          <button type="submit" aria-label="Zoeken" className="absolute top-1/2 right-1.5 grid h-10 w-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-brand text-white hover:bg-brand-600">
            <Icon name="search" className="h-5 w-5" strokeWidth={2.2} />
          </button>
        </form>

        {tree.length > 0 && (
          <>
            <h2 className="mt-12 mb-4 text-[length:var(--text-title)]">{t.categories}</h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
              {tree.map((c) => (
                <li key={c.id}>
                  <CategoryTile tile={{ path: c.path, name: c.navTitle, count: c.count, image: c.image, highlight: c.highlight }} />
                </li>
              ))}
            </ul>
          </>
        )}

        <Link href="/" className="btn-primary mt-10">
          {t.home}
        </Link>
      </section>
    </>
  );
}
