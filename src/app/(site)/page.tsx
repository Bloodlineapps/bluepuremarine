import type { Metadata } from "next";
import { HomeView } from "@/components/site/HomeView";
import { resolvePath } from "@/lib/content";
import { getHome } from "@/lib/home";
import { buildMetadata, seoDescription, shopTails, titleFor } from "@/lib/seo";
import { getShop } from "@/lib/settings";

// Homepage. De inhoud komt uit de homepage-instellingen (actieblokken, H1, teksten); title en description uit de
// CMS-pagina "home" als die bestaat, anders uit de H1 en de inleiding.
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const [home, page, shop] = await Promise.all([getHome(), resolvePath("/"), getShop()]);
  return buildMetadata({
    title: titleFor(page?.metaTitle, "Bootonderhoud en bootonderdelen", [" online kopen"]),
    description: seoDescription(page?.metaDescription || home.intro, shopTails(shop)),
    path: "/",
    image: page?.ogImage || home.hero[0].image || null,
  });
}

export default function Home() {
  return <HomeView />;
}
