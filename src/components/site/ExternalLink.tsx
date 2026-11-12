/** Link naar een ander domein: nieuw tabblad, rel="noopener noreferrer" en een melding voor schermlezers. */
export function ExternalLink({ href, className, children, rel, label }: { href: string; className?: string; children: React.ReactNode; rel?: "sponsored" | "ugc"; label?: string; locale?: string }) {
  return (
    <a href={href} target="_blank" rel={`noopener noreferrer${rel ? ` ${rel}` : ""}`} className={className} aria-label={label ? `${label} (opent in nieuw tabblad)` : undefined}>
      {children}
      {!label && <span className="sr-only"> (opent in nieuw tabblad)</span>}
    </a>
  );
}
