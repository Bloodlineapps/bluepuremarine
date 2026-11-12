import Link from "next/link";
import { Icon } from "@/components/Icon";
import { AccountLink } from "@/components/shop/AccountLink";
import { CartIndicator } from "@/components/shop/CartIndicator";
import { pagePaths } from "@/lib/content";
import { mainMenu, type MenuLink } from "@/lib/menu";
import { getShop } from "@/lib/settings";
import { categoryTree, type CategoryNode } from "@/lib/shop";
import { ExternalLink } from "./ExternalLink";
import { Logo } from "./Logo";
import { MobileMenu, PanelCloser } from "./MobileMenu";
import { ReviewBadge } from "./ReviewBadge";

// Header van de webshop, in drie lagen: (1) smalle balk met de voordelen en servicelinks, (2) logo, knop
// "Alle categorieën", reviewscore, zoekveld, account en winkelwagen, (3) blauwe balk met de categorieën als
// megamenu. De panelen openen met hover én met focus (toetsenbord) en dus ook zonder JavaScript; het zoekveld is een
// gewoon GET-formulier. Op mobiel staat alles in een uitschuifmenu (<details>).

/** Subcategorieën gegroepeerd per menuGroup, in de volgorde waarin de groepen voorkomen. */
function groupsOf(cat: CategoryNode) {
  const groups: { title: string; items: CategoryNode[] }[] = [];
  for (const c of cat.children) {
    const title = c.menuGroup || "Categorieën";
    (groups.find((g) => g.title === title) ?? groups[groups.push({ title, items: [] }) - 1]).items.push(c);
  }
  return groups;
}

function MenuAnchor({ item, className }: { item: MenuLink; className: string }) {
  return item.external ? (
    <ExternalLink href={item.href} className={className}>
      {item.label}
    </ExternalLink>
  ) : (
    <Link href={item.href} className={className}>
      {item.label}
    </Link>
  );
}

function SearchForm({ className = "" }: { className?: string }) {
  return (
    <form action="/zoeken/" method="get" role="search" className={`relative ${className}`}>
      <label htmlFor="site-search" className="sr-only">
        Zoek in de webshop
      </label>
      <input id="site-search" type="search" name="q" required minLength={2} maxLength={80} placeholder="Waar ben je naar op zoek?" autoComplete="off" enterKeyHint="search" className="field h-12 rounded-full border-2 pr-14 pl-5 text-ellipsis" />
      <button type="submit" aria-label="Zoeken" className="absolute top-1 right-1 grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-brand text-white transition-colors hover:bg-brand-600">
        <Icon name="search" className="h-5 w-5" strokeWidth={2.2} />
      </button>
    </form>
  );
}

function MegaPanel({ cat }: { cat: CategoryNode }) {
  const groups = groupsOf(cat);
  return (
    <div className="menu-panel absolute inset-x-0 top-full z-50">
      <div className="container-x">
        <div className="rounded-b-card border border-t-0 border-rule bg-sheet p-6 text-ink-2 shadow-lift xl:p-8">
          <div className="grid gap-8" style={{ gridTemplateColumns: `repeat(${Math.min(groups.length, 3)}, minmax(0, 17rem)) 1fr` }}>
            {groups.map((g) => (
              <div key={g.title}>
                <p className="eyebrow border-b border-rule pb-2 text-muted">{g.title}</p>
                <ul className="mt-2">
                  {g.items.map((c) => (
                    <li key={c.id}>
                      <Link href={c.path} className="group/item flex min-h-10 items-center justify-between gap-4 rounded-md px-2 text-[0.97rem] font-medium text-ink hover:bg-brand-50 hover:text-brand">
                        <span>{c.navTitle}</span>
                        <span className="text-[0.8rem] font-normal text-muted tabular-nums">
                          {c.count}
                          <span className="sr-only"> producten</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {cat.intro && (
              <div className="hidden self-start justify-self-end rounded-card bg-paper p-5 xl:block xl:max-w-sm">
                <p className="h-display text-[1.5rem] text-navy">{cat.navTitle}</p>
                <p className="mt-2 line-clamp-4 text-[0.92rem]">{cat.intro}</p>
              </div>
            )}
          </div>
          <Link href={cat.path} className="mt-6 inline-flex min-h-10 items-center gap-2 border-t border-rule pt-4 font-bold text-brand hover:text-aqua-600">
            Alles in {cat.navTitle}
            <Icon name="arrow" className="h-4 w-4" strokeWidth={2.2} />
          </Link>
        </div>
      </div>
    </div>
  );
}

export async function Header() {
  const [shop, tree, menu, paths] = await Promise.all([getShop(), categoryTree(), mainMenu(), pagePaths()]);
  const usps = shop.usps.filter(Boolean).slice(0, 3);
  const service = paths.klantenservice ?? paths.contact ?? null;

  return (
    <header className="relative z-40 bg-sheet">
      <PanelCloser />

      {/* 1. voordelen + servicelinks */}
      <div className="border-b border-rule text-[0.84rem]">
        <div className="container-x flex min-h-9 items-center justify-between gap-6">
          <ul className="flex min-w-0 flex-1 items-center justify-center gap-x-7 md:justify-start">
            {usps.map((u, i) => (
              <li key={u} className={`items-center gap-1.5 whitespace-nowrap font-medium text-ink-2 ${i === 0 ? "flex" : i === 1 ? "hidden sm:flex" : "hidden lg:flex"}`}>
                <Icon name="check" className="h-4 w-4 shrink-0 text-success" strokeWidth={2.6} />
                {u}
              </li>
            ))}
          </ul>
          <ul className="hidden shrink-0 items-center gap-x-5 text-muted md:flex">
            {service && (
              <li>
                <Link href={service} className="underline-grow inline-flex min-h-9 items-center hover:text-brand">
                  Klantenservice
                </Link>
              </li>
            )}
            <li>
              <Link href="/blog/" className="underline-grow inline-flex min-h-9 items-center hover:text-brand">
                Blog
              </Link>
            </li>
            <li>
              <Link href="/account/" className="underline-grow inline-flex min-h-9 items-center hover:text-brand">
                Mijn account
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {/* 2. logo, alle categorieën, reviews, zoeken, account, winkelwagen */}
      <div className="container-x flex flex-wrap items-center gap-x-3 gap-y-3 py-3 lg:flex-nowrap lg:gap-x-5 lg:py-4 2xl:gap-x-6">
        <MobileMenu>
          <nav aria-label="Mobiel menu" className="container-x py-4">
            <ul>
              {tree.map((cat) =>
                cat.children.length ? (
                  <li key={cat.id} className="border-b border-rule">
                    <details className="faq-item group/cat">
                      <summary className="flex min-h-12 items-center justify-between gap-3 font-bold text-ink">
                        <span className={cat.highlight ? "text-coral-700" : ""}>{cat.navTitle}</span>
                        <Icon name="chevron" className="h-5 w-5 text-muted transition-transform group-open/cat:rotate-180" />
                      </summary>
                      <div className="pb-3 pl-3">
                        {groupsOf(cat).map((g) => (
                          <div key={g.title} className="mt-2 first:mt-0">
                            <p className="eyebrow text-muted">{g.title}</p>
                            <ul>
                              {g.items.map((c) => (
                                <li key={c.id}>
                                  <Link href={c.path} className="flex min-h-11 items-center justify-between gap-3 text-ink-2">
                                    <span>{c.navTitle}</span>
                                    <span className="text-[0.82rem] text-muted tabular-nums">{c.count}</span>
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                        <Link href={cat.path} className="mt-1 flex min-h-11 items-center gap-2 font-bold text-brand">
                          Alles in {cat.navTitle}
                          <Icon name="arrow" className="h-4 w-4" strokeWidth={2.2} />
                        </Link>
                      </div>
                    </details>
                  </li>
                ) : (
                  <li key={cat.id} className="border-b border-rule">
                    <Link href={cat.path} className={`flex min-h-12 items-center font-bold ${cat.highlight ? "text-coral-700" : "text-ink"}`}>
                      {cat.navTitle}
                    </Link>
                  </li>
                ),
              )}
              {menu.map((m) => (
                <li key={m.label} className="border-b border-rule">
                  <MenuAnchor item={m} className="flex min-h-12 items-center font-medium text-ink" />
                </li>
              ))}
              <li>
                <Link href="/account/" className="flex min-h-12 items-center gap-2 font-medium text-ink">
                  <Icon name="user" className="h-5 w-5 text-brand" />
                  Mijn account
                </Link>
              </li>
            </ul>
          </nav>
        </MobileMenu>

        <Link href="/" className="shrink-0 rounded-md" aria-label="BluePure Marine, naar de homepage">
          <Logo className="h-10 w-auto sm:h-12 lg:h-14" />
        </Link>

        <div className="has-panel relative hidden xl:block">
          <button type="button" aria-haspopup="true" className="btn-secondary h-12 gap-2 px-4">
            <Icon name="menu" className="h-5 w-5 text-brand" strokeWidth={2.2} />
            Alle categorieën
            <Icon name="chevron" className="h-4 w-4 text-muted" />
          </button>
          <div className="menu-panel absolute top-full left-0 z-50 w-80 pt-2">
            <ul className="rounded-card border border-rule bg-sheet p-2 shadow-lift">
              {tree.map((cat) => (
                <li key={cat.id}>
                  <Link href={cat.path} className={`flex min-h-11 items-center justify-between gap-4 rounded-md px-3 font-semibold hover:bg-brand-50 hover:text-brand ${cat.highlight ? "text-coral-700" : "text-ink"}`}>
                    <span>{cat.navTitle}</span>
                    <span className="text-[0.8rem] font-normal text-muted tabular-nums">
                      {cat.count}
                      <span className="sr-only"> producten</span>
                    </span>
                  </Link>
                </li>
              ))}
              <li className="mt-1 border-t border-rule pt-1">
                <Link href="/merken/" className="flex min-h-11 items-center justify-between gap-4 rounded-md px-3 font-semibold text-brand hover:bg-brand-50">
                  Alle merken
                  <Icon name="arrow" className="h-4 w-4" strokeWidth={2.2} />
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <ReviewBadge className="hidden xl:block" />

        <SearchForm className="order-last w-full lg:order-none lg:w-auto lg:min-w-0 lg:flex-1" />

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3 lg:ml-0">
          <AccountLink />
          <CartIndicator />
        </div>
      </div>

      {/* 3. blauwe balk met categorieën (megamenu) en de extra links */}
      <nav aria-label="Hoofdmenu" className="relative hidden bg-brand text-white lg:block">
        <div className="container-x">
          <ul className="flex items-stretch">
            {tree.map((cat) => {
              const link = cat.highlight
                ? "flex h-12 items-center gap-1.5 bg-coral px-3 text-[0.9rem] font-bold whitespace-nowrap text-navy-900 transition-colors hover:bg-sun 2xl:px-4 2xl:text-[0.97rem]"
                : "flex h-12 items-center gap-1.5 px-3 text-[0.9rem] font-semibold whitespace-nowrap text-white transition-colors hover:bg-brand-700 2xl:px-4 2xl:text-[0.97rem]";
              return cat.children.length ? (
                <li key={cat.id} className="has-panel">
                  <Link href={cat.path} className={link} aria-haspopup="true">
                    {cat.navTitle}
                    <Icon name="chevron" className="h-4 w-4 opacity-80" />
                  </Link>
                  <MegaPanel cat={cat} />
                </li>
              ) : (
                <li key={cat.id}>
                  <Link href={cat.path} className={link}>
                    {cat.navTitle}
                  </Link>
                </li>
              );
            })}
            {menu.map((m, i) => (
              <li key={m.label} className={`hidden xl:block ${i === 0 ? "ml-auto" : ""}`}>
                <MenuAnchor item={m} className="flex h-12 items-center px-2.5 text-[0.9rem] font-medium whitespace-nowrap text-white transition-colors hover:bg-brand-700 2xl:px-3 2xl:text-[0.94rem]" />
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </header>
  );
}
