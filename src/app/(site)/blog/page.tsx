import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { JsonLd } from "@/components/site/JsonLd";
import { Pagination, parseListing, type SP } from "@/components/site/listing";
import { PostCard } from "@/components/site/ui";
import { db } from "@/lib/db";
import { breadcrumbLd, buildMetadata, graph, itemListLd, seoDescription, seoTitle } from "@/lib/seo";
import { livePost } from "@/lib/shop";

// Blogoverzicht met kaarten en paginering (?pagina=2; pagina 1 zonder parameter, niet-bestaande pagina → 404).

type Props = { searchParams: Promise<SP> };
const PER_PAGE = 9;
const crumbs = [{ name: "Blog", path: "/blog/" }];
const INTRO = "Praktische tips over het reinigen en onderhouden van je boot, en uitleg over bootonderdelen en elektronica. Geschreven vanuit de praktijk van BluePure Marine.";

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { page } = parseListing(await searchParams);
  return buildMetadata({
    title: seoTitle("Blog over bootonderhoud", [" en techniek"], page),
    description: seoDescription(INTRO, ["Lees de nieuwste artikelen."], page),
    path: "/blog/",
    page,
  });
}

export default async function BlogIndex({ searchParams }: Props) {
  const s = parseListing(await searchParams);
  if (!s.validPage) notFound();
  if (s.pageOne) permanentRedirect("/blog/");
  const where = livePost();
  const [total, posts] = await Promise.all([db.post.count({ where }), db.post.findMany({ where, orderBy: { publishedAt: "desc" }, skip: (s.page - 1) * PER_PAGE, take: PER_PAGE, include: { category: true } })]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  if (s.page > pages) notFound();

  return (
    <>
      <JsonLd
        data={graph(
          breadcrumbLd(crumbs),
          itemListLd(
            "Blog van BluePure Marine",
            posts.map((p) => ({ name: p.title, path: p.path })),
          ),
        )}
      />
      <div className="border-b border-rule bg-paper">
        <div className="container-x py-6 lg:py-8">
          <Breadcrumbs items={crumbs} />
          <h1 className="h-display mt-3 text-[length:var(--text-hero)] text-navy">Blog</h1>
          <p className="mt-3 max-w-[72ch] text-[length:var(--text-lede)]">{INTRO}</p>
        </div>
      </div>
      <section id="artikelen" className="container-x scroll-mt-4 pt-8" aria-label="Blogartikelen">
        <p className="mb-4 text-[0.9rem] text-muted" role="status">
          Pagina {s.page} van {pages}, {total} {total === 1 ? "artikel" : "artikelen"}
        </p>
        {posts.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p, i) => (
              <li key={p.id}>
                <PostCard post={p} as="h2" priority={i < 3} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-card border border-rule bg-paper p-6">Er staan nog geen blogartikelen online.</p>
        )}
        <Pagination page={s.page} pages={pages} href={(n) => `/blog/${n > 1 ? `?pagina=${n}` : ""}#artikelen`} label="Paginering van de blogartikelen" />
      </section>
    </>
  );
}
