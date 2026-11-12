import { sitemapXml } from "@/lib/sitemap";

export const revalidate = 3600;
export const GET = () => sitemapXml("blog");
