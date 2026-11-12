"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Subtabjes met elk een eigen URL (connecties, instellingen). */
export function SubTabs({ tabs, label }: { tabs: { href: string; label: string }[]; label: string }) {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label={label} className="flex flex-wrap gap-1 rounded-2xl border border-line bg-white p-1.5">
      {tabs.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={`rounded-xl px-4 py-2 text-sm font-medium transition ${active ? "bg-navy text-white" : "text-ink hover:bg-cream"}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
