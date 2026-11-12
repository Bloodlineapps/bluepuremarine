import { renderHtml } from "@/lib/html";

/**
 * Rendert opgeschoonde CMS-HTML (pagina's, productomschrijvingen, blogs; al gesanitized bij opslaan): externe links
 * openen in een nieuw tabblad met rel="noopener noreferrer" en schermlezertekst, afbeeldingen laden lazy.
 */
export async function Html({ html, className = "", eagerFirstImage }: { html: string | null | undefined; className?: string; eagerFirstImage?: boolean; locale?: string }) {
  const out = await renderHtml(html, { externalNote: "(opent in nieuw tabblad)", eagerFirstImage });
  if (!out) return null;
  return <div className={`prose-bp ${className}`} dangerouslySetInnerHTML={{ __html: out }} />;
}
