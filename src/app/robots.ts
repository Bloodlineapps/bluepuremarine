import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/settings";

// robots.txt. Geblokkeerd: beheer, API, winkelwagen, afrekenen, bestelling, klantaccount en zoekresultaten (die
// pagina's zijn daarnaast noindex). CSS, JS en afbeeldingen blijven open, en AI-crawlers (GPTBot, OAI-SearchBot,
// ClaudeBot, PerplexityBot) worden niet geblokkeerd.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin/", "/api/", "/winkelwagen/", "/afrekenen/", "/bestelling/", "/account/", "/zoeken/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
