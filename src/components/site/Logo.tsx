import Image from "next/image";

/** Logo van BluePure Marine (public/logo.svg, verhouding 1285×545). Geen kop: de H1 staat altijd in de pagina. */
export function Logo({ className = "h-11 w-auto", tagline }: { className?: string; tagline?: string }) {
  return (
    <span className="inline-flex items-center gap-3">
      <Image src="/logo.svg" alt="BluePure Marine" width={142} height={60} unoptimized priority className={className} />
      {tagline && <span className="hidden border-l border-rule pl-3 text-[0.9rem] leading-tight text-muted xl:inline">{tagline}</span>}
    </span>
  );
}
