import { sitemapIndexXml } from "@/lib/sitemap";

// Sitemap-index: verwijst naar /sitemap-paginas.xml, /sitemap-categorieen.xml, /sitemap-producten.xml en /sitemap-blog.xml.
export const revalidate = 3600;
export const GET = () => sitemapIndexXml();
