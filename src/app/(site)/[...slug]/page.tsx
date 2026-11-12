import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryView, categoryMetadata } from "@/components/site/CategoryView";
import { PageView } from "@/components/site/PageView";
import type { SP } from "@/components/site/listing";
import { resolvePath } from "@/lib/content";
import { buildMetadata, notFoundMetadata, seoDescription, shopTails, titleFor } from "@/lib/seo";
import { getShop } from "@/lib/settings";
import { categoryByPath } from "@/lib/shop";

// Catch-all voor alle URL's zonder eigen route: eerst een productcategorie (/onderhoud/, /onderhoud/exterieur/),
// anders een CMS-pagina (/contact/, /privacy/ …), anders een 404. Categorieën lezen filters en paginering uit de
// query, dus deze route rendert per verzoek op de server (de HTML is altijd volledig).

type Props = { params: Promise<{ slug: string[] }>; searchParams: Promise<SP> };

function pathOf(slug: string[]) {
  try {
    return `/${slug.map((s) => decodeURIComponent(s).toLowerCase()).join("/")}/`;
  } catch {
    return `/${slug.join("/")}/`;
  }
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const path = pathOf((await params).slug);
  const category = await categoryByPath(path);
  if (category) return categoryMetadata(category, await searchParams);
  const page = await resolvePath(path);
  if (!page) return notFoundMetadata;
  return buildMetadata({
    title: titleFor(page.metaTitle, page.navTitle || page.title, page.template === "legal" ? [" – juridische informatie"] : [" – klantenservice", " en informatie"]),
    description: seoDescription(page.metaDescription || page.intro || page.summary || page.title, page.template === "legal" ? [] : shopTails(await getShop())),
    path: page.path,
    image: page.ogImage || page.heroImage,
    noindex: page.noindex,
    modifiedTime: page.updatedAt,
  });
}

export default async function CatchAll({ params, searchParams }: Props) {
  const path = pathOf((await params).slug);
  const category = await categoryByPath(path);
  if (category) return <CategoryView category={category} searchParams={await searchParams} />;
  const page = await resolvePath(path);
  if (!page || page.path === "/") notFound();
  return <PageView page={page} />;
}
