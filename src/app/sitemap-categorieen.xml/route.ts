import { sitemapXml } from "@/lib/sitemap";

// Categorieën en merkpagina's.
export const revalidate = 3600;
export const GET = () => sitemapXml("categorieen");
