import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { Html } from "@/components/site/Html";
import { JsonLd } from "@/components/site/JsonLd";
import { CategoryTile, PostCard, SectionHeading } from "@/components/site/ui";
import { db } from "@/lib/db";
import { parse } from "@/lib/json";
import { blogPostingLd, breadcrumbLd, buildMetadata, graph, notFoundMetadata, seoDescription, titleFor } from "@/lib/seo";
import { categoryTree, livePost, postBySlug } from "@/lib/shop";
import { formatDate, plain } from "@/lib/text";

// Blogartikel. Vooraf gerenderd voor alle gepubliceerde artikelen; nieuwe artikelen bij het eerste bezoek, en het
// beheer ververst de pagina na opslaan (revalidatePath).

type Props = { params: Promise<{ slug: string }> };
export const dynamicParams = true;
export const revalidate = 3600;

export async function generateStaticParams() {
  try {
    return (await db.post.findMany({ where: livePost(), select: { slug: true } })).map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await postBySlug((await params).slug);
  if (!post) return notFoundMetadata;
  return buildMetadata({
    title: titleFor(post.metaTitle, post.title, [" – blog", " over bootonderhoud"]),
    description: seoDescription(post.metaDescription || post.excerpt || plain(post.content), ["Lees het hele artikel op het blog van BluePure Marine."]),
    path: post.path,
    image: post.image,
    type: "article",
    noindex: post.noindex,
    publishedTime: post.publishedAt,
    modifiedTime: post.updatedAt,
  });
}

export default async function BlogPost({ params }: Props) {
  const post = await postBySlug((await params).slug);
  if (!post) notFound();
  const tags = parse<string[]>(post.tags, []).filter(Boolean);
  const [sameCategory, tree] = await Promise.all([
    db.post.findMany({ where: { ...livePost(), id: { not: post.id }, ...(post.categoryId ? { categoryId: post.categoryId } : {}) }, orderBy: { publishedAt: "desc" }, take: 3, include: { category: true } }),
    categoryTree(),
  ]);
  const related = sameCategory.length >= 3 || !post.categoryId ? sameCategory : [...sameCategory, ...(await db.post.findMany({ where: { ...livePost(), id: { notIn: [post.id, ...sameCategory.map((p) => p.id)] } }, orderBy: { publishedAt: "desc" }, take: 3 - sameCategory.length, include: { category: true } }))];
  const crumbs = [
    { name: "Blog", path: "/blog/" },
    { name: post.title, path: post.path },
  ];
  const description = seoDescription(post.excerpt || plain(post.content));
  const edited = post.updatedAt.getTime() - post.publishedAt.getTime() > 24 * 60 * 60 * 1000;

  return (
    <>
      <JsonLd data={graph(breadcrumbLd(crumbs), blogPostingLd({ path: post.path, title: post.title, description, image: post.image, published: post.publishedAt, modified: post.updatedAt > post.publishedAt ? post.updatedAt : post.publishedAt }))} />

      <article>
        <header className="border-b border-rule bg-paper">
          <div className="container-x py-6 lg:py-9">
            <Breadcrumbs items={crumbs} />
            <div className="mx-auto mt-5 max-w-[52rem]">
              {post.category && <p className="eyebrow">{post.category.name}</p>}
              <h1 className="mt-2 text-[clamp(1.8rem,1.3rem+2.2vw,3rem)]">{post.title}</h1>
              <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[0.92rem] text-muted">
                <span>
                  Gepubliceerd op <time dateTime={post.publishedAt.toISOString().slice(0, 10)}>{formatDate(post.publishedAt)}</time>
                </span>
                {edited && (
                  <span>
                    Bijgewerkt op <time dateTime={post.updatedAt.toISOString().slice(0, 10)}>{formatDate(post.updatedAt)}</time>
                  </span>
                )}
                <span>Door {post.authorName}</span>
              </p>
              {post.excerpt && <p className="mt-5 text-[length:var(--text-lede)]">{post.excerpt}</p>}
            </div>
          </div>
        </header>

        <div className="container-x pt-8">
          <div className="mx-auto max-w-[52rem]">
            {post.image && (
              <div className="relative mb-8 aspect-[16/9] overflow-hidden rounded-card">
                <Image src={post.image} alt={post.imageAlt} width={1280} height={720} priority sizes="(min-width: 900px) 832px, 94vw" className="absolute inset-0 h-full w-full object-cover" />
              </div>
            )}
            <Html html={post.content} />
            {tags.length > 0 && (
              <ul className="mt-8 flex flex-wrap gap-2 border-t border-rule pt-5" aria-label="Onderwerpen van dit artikel">
                {tags.map((t) => (
                  <li key={t} className="badge bg-brand-50 px-3 py-1 text-[0.82rem] text-brand-700">
                    {t}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-8">
              <Link href="/blog/" className="underline-grow inline-flex min-h-10 items-center gap-1.5 font-bold text-brand">
                <Icon name="arrowLeft" className="h-4 w-4" strokeWidth={2.2} />
                Terug naar het blogoverzicht
              </Link>
            </p>
          </div>
        </div>
      </article>

      {tree.length > 0 && (
        <section className="reveal container-x pt-[var(--spacing-section)]" aria-labelledby="blog-categorieen">
          <SectionHeading id="blog-categorieen" eyebrow="Direct aan de slag" title="Shop per categorie" />
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
            {tree.map((c) => (
              <li key={c.id}>
                <CategoryTile tile={{ path: c.path, name: c.navTitle, count: c.count, image: c.image, highlight: c.highlight }} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {related.length > 0 && (
        <section className="reveal container-x pt-[var(--spacing-section)]" aria-labelledby="blog-gerelateerd">
          <SectionHeading id="blog-gerelateerd" eyebrow="Verder lezen" title="Gerelateerde artikelen" href="/blog/" linkLabel="Alle blogartikelen" />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <li key={p.id}>
                <PostCard post={p} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
