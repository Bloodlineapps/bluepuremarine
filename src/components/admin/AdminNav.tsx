"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { ROLE_LABELS } from "@/lib/admin/labels";

// Vast zijmenu van het beheer. Connecties zijn alleen zichtbaar voor Beheerder en Superadmin; de rest is voor
// iedereen. De bolletjes tonen wat er op je wacht (te verzenden bestellingen, reviews, inzendingen, prullenbak).

type Item = { href: string; label: string; icon: IconName; min?: "admin" | "superadmin"; badge?: number };
export type NavCounts = { orders: number; reviews: number; submissions: number; trash: number };

const RANK: Record<string, number> = { user: 1, admin: 2, superadmin: 3 };

export function AdminNav({ user, counts, logout }: { user: { name: string; roleName: string; role: string }; counts: NavCounts; logout: () => Promise<void> }) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const groups: { title: string; items: Item[] }[] = [
    { title: "", items: [{ href: "/admin/", label: "Dashboard", icon: "home" }] },
    {
      title: "Webshop",
      items: [
        { href: "/admin/bestellingen/", label: "Bestellingen", icon: "cart", badge: counts.orders },
        { href: "/admin/producten/", label: "Producten", icon: "box" },
        { href: "/admin/categorieen/", label: "Categorieën", icon: "folder" },
        { href: "/admin/merken/", label: "Merken", icon: "award" },
        { href: "/admin/klanten/", label: "Klanten", icon: "users" },
        { href: "/admin/kortingscodes/", label: "Kortingscodes", icon: "percent" },
        { href: "/admin/reviews/", label: "Reviews", icon: "star", badge: counts.reviews },
      ],
    },
    {
      title: "Content",
      items: [
        { href: "/admin/paginas/", label: "Pagina's", icon: "pages" },
        { href: "/admin/blog/", label: "Blog", icon: "news" },
        { href: "/admin/faq/", label: "Veelgestelde vragen", icon: "chat" },
        { href: "/admin/menus/", label: "Menu's", icon: "menu" },
        { href: "/admin/media/", label: "Media", icon: "camera" },
      ],
    },
    {
      title: "Aanvragen",
      items: [
        { href: "/admin/formulieren/", label: "Formulieren", icon: "form", badge: counts.submissions },
        { href: "/admin/nieuwsbrief/", label: "Nieuwsbrief", icon: "mail" },
      ],
    },
    {
      title: "SEO",
      items: [
        { href: "/admin/seo/", label: "SEO-overzicht", icon: "search" },
        { href: "/admin/redirects/", label: "Redirects", icon: "arrow" },
      ],
    },
    {
      title: "Beheer",
      items: [
        { href: "/admin/connecties/", label: "Connecties", icon: "link", min: "admin" },
        { href: "/admin/gebruikers/", label: "Gebruikers", icon: "user" },
        { href: "/admin/instellingen/", label: "Instellingen", icon: "gear" },
        { href: "/admin/revisiegeschiedenis/", label: "Revisiegeschiedenis", icon: "history" },
        { href: "/admin/prullenbak/", label: "Prullenbak", icon: "trash", badge: counts.trash },
        { href: "/admin/logboek/", label: "Logboek", icon: "clock" },
      ],
    },
  ];
  const active = (i: Item) => (i.href === "/admin/" ? pathname === i.href : pathname.startsWith(i.href));
  // eslint-disable-next-line @next/next/no-img-element
  const logo = (cls: string) => <img src="/logo.svg" alt="BluePure Marine" className={cls} />;

  return (
    <>
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between bg-navy px-4 text-white lg:hidden">
        <span className="rounded-lg bg-white px-2 py-1">{logo("h-7 w-auto")}</span>
        <button type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="admin-sidebar" className="rounded-lg p-2" aria-label="Menu openen">
          <Icon name="menu" />
        </button>
      </div>
      {open && <div className="fixed inset-0 z-40 bg-navy-900/60 lg:hidden" onClick={() => setOpen(false)} />}
      <aside id="admin-sidebar" className={`on-dark fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-navy text-white transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-20 shrink-0 items-center justify-between px-5">
          <Link href="/admin/" aria-label="Dashboard" className="rounded-xl bg-white px-3 py-1.5">
            {logo("h-9 w-auto")}
          </Link>
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 lg:hidden" aria-label="Menu sluiten">
            <Icon name="close" />
          </button>
        </div>
        <nav aria-label="Beheermenu" className="flex-1 space-y-5 overflow-y-auto px-3 py-3">
          {groups.map((g) => (
            <div key={g.title || "main"}>
              {g.title && <p className="mb-1 px-3 text-[0.7rem] font-semibold uppercase tracking-wider text-white/50">{g.title}</p>}
              <ul className="space-y-0.5">
                {g.items
                  .filter((i) => !i.min || (RANK[user.role] ?? 0) >= RANK[i.min])
                  .map((i) => (
                    <li key={i.href}>
                      <Link href={i.href} aria-current={active(i) ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${active(i) ? "bg-white font-semibold text-navy" : "text-white/85 hover:bg-white/10 hover:text-white"}`}>
                        <Icon name={i.icon} className="h-[1.1rem] w-[1.1rem] shrink-0" />
                        <span className="flex-1">{i.label}</span>
                        {!!i.badge && <span className="rounded-full bg-sun px-2 text-xs font-semibold text-navy">{i.badge}</span>}
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="shrink-0 border-t border-white/10 p-4 text-sm">
          <p className="font-medium">{user.name}</p>
          <p className="text-xs text-white/65">{ROLE_LABELS[user.role] ?? user.roleName}</p>
          <div className="mt-3 flex gap-2">
            <Link href="/" target="_blank" className="rounded-full border border-white/25 px-3 py-1 text-xs hover:bg-white/10">
              Bekijk webshop
            </Link>
            <form action={logout}>
              <button className="rounded-full border border-white/25 px-3 py-1 text-xs hover:bg-white/10">Uitloggen</button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
