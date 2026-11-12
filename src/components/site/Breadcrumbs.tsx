import Link from "next/link";
import type { Crumb } from "@/lib/seo";

/** Zichtbaar kruimelpad (alle pagina's behalve de homepage); dezelfde items staan als BreadcrumbList in de JSON-LD. */
export function Breadcrumbs({ items, className = "" }: { items: Crumb[]; className?: string; locale?: string }) {
  return (
    <nav aria-label="Kruimelpad" className={`text-[0.88rem] text-muted ${className}`}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <li>
          <Link href="/" className="inline-flex min-h-8 items-center underline-offset-4 hover:text-brand hover:underline">
            Home
          </Link>
        </li>
        {items.map((c, i) => (
          <li key={c.path} className="flex min-w-0 items-center gap-2">
            <span aria-hidden="true" className="text-rule">
              /
            </span>
            {i === items.length - 1 ? (
              <span aria-current="page" className="line-clamp-1 font-medium text-ink">
                {c.name}
              </span>
            ) : (
              <Link href={c.path} className="inline-flex min-h-8 items-center underline-offset-4 hover:text-brand hover:underline">
                {c.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
