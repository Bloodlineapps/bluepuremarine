import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon";
import { pagePaths } from "@/lib/content";
import { dict, fmt } from "@/lib/i18n";
import { footerMenu, type MenuLink } from "@/lib/menu";
import { getShop, getSite } from "@/lib/settings";
import { CookieSettingsButton } from "./CookieConsent";
import { ExternalLink } from "./ExternalLink";
import { LinkedInIcon, PaymentBadges, WhatsAppIcon, XIcon } from "./icons";
import { NewsletterForm } from "./NewsletterForm";

// Footer in drie lagen: (1) hulpstrook met vier kolommen (klantenservice, veelgestelde vragen, bellen, mailen),
// (2) lichtblauw vlak met nieuwsbrief, voordelen en sociale kanalen links en de linkkolommen rechts,
// (3) betaalmethoden, copyright, juridische links en KvK/btw. Lege gegevens worden niet getoond.

const linkCls = "underline-grow inline-flex min-h-11 items-center lg:min-h-9 text-[0.95rem] text-ink-2 hover:text-brand";

function FooterLink({ item }: { item: MenuLink }) {
  return item.external ? (
    <ExternalLink href={item.href} className={linkCls}>
      {item.label}
    </ExternalLink>
  ) : (
    <Link href={item.href} className={linkCls}>
      {item.label}
    </Link>
  );
}

function HelpItem({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-50 text-brand">{icon}</span>
      <div>
        <p className="font-bold text-ink">{title}</p>
        <div className="mt-0.5 text-[0.95rem]">{children}</div>
      </div>
    </div>
  );
}

export async function Footer() {
  const t = dict("nl").footer;
  const [site, shop, columns, paths] = await Promise.all([getSite(), getShop(), footerMenu(), pagePaths()]);
  const usps = shop.usps.filter(Boolean);
  const socials: { key: string; label: string; href: string; icon: React.ReactNode }[] = (
    [
      ["facebook", "Facebook", <Icon key="i" name={"facebook" as IconName} className="h-5 w-5" />],
      ["instagram", "Instagram", <Icon key="i" name={"instagram" as IconName} className="h-5 w-5" />],
      ["youtube", "YouTube", <Icon key="i" name={"youtube" as IconName} className="h-5 w-5" />],
      ["linkedin", "LinkedIn", <LinkedInIcon key="i" />],
      ["x", "X", <XIcon key="i" />],
    ] as const
  )
    .map(([key, label, icon]) => ({ key, label, icon, href: site.socials[key] }))
    .filter((s) => !!s.href);
  const legal = [
    { label: "Privacy", href: paths.privacy },
    { label: "Cookies", href: paths.cookies },
    { label: "Algemene voorwaarden", href: paths.terms },
  ].filter((l): l is { label: string; href: string } => !!l.href);
  const address = [site.street, [site.postalCode, site.city].filter(Boolean).join(" ")].filter(Boolean);

  return (
    <footer className="mt-[var(--spacing-section)]">
      {/* 1. hulpstrook */}
      <div className="border-y border-rule bg-sheet">
        <div className="container-x grid gap-x-8 gap-y-6 py-8 sm:grid-cols-2 lg:grid-cols-4">
          <HelpItem icon={<Icon name="chat" className="h-7 w-7" />} title={t.helpTitle}>
            <p>Onze klantenservice staat{site.serviceHours ? ` van ${site.serviceHours}` : ""} voor je klaar.</p>
          </HelpItem>
          {paths.faq && (
            <HelpItem icon={<Icon name="info" className="h-7 w-7" />} title={t.faqTitle}>
              <Link href={paths.faq} className="link inline-flex items-center max-lg:min-h-11">
                {t.faqLink}
              </Link>
            </HelpItem>
          )}
          {site.phone && (
            <HelpItem icon={<Icon name="phone" className="h-7 w-7" />} title={t.call}>
              <a href={`tel:${site.phoneIntl || site.phone.replace(/[^+\d]/g, "")}`} className="link inline-flex items-center whitespace-nowrap max-lg:min-h-11">
                {site.phone}
              </a>
            </HelpItem>
          )}
          {site.email && (
            <HelpItem icon={<Icon name="mail" className="h-7 w-7" />} title={t.mail}>
              <a href={`mailto:${site.email}`} className="link inline-flex items-center break-all max-lg:min-h-11">
                {site.email}
              </a>
            </HelpItem>
          )}
        </div>
      </div>

      {/* 2. nieuwsbrief + voordelen | linkkolommen */}
      <div className="bg-brand-50">
        <div className="container-x grid gap-10 py-[var(--spacing-section-sm)] lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-16">
          <div>
            <h2 className="h-display text-[1.9rem] text-navy">{t.newsletterTitle}</h2>
            <p className="mt-2 text-[0.95rem]">{t.newsletterText}</p>
            <NewsletterForm />

            {usps.length > 0 && (
              <>
                <h2 className="mt-6 text-[1.05rem]">{t.benefits}</h2>
                <ul className="mt-2 space-y-1.5">
                  {usps.map((u) => (
                    <li key={u} className="flex items-start gap-2 text-[0.95rem]">
                      <Icon name="check" className="mt-1 h-4 w-4 shrink-0 text-success" strokeWidth={2.6} />
                      {u}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {socials.length > 0 && (
              <>
                <h2 className="mt-6 text-[1.05rem]">{t.follow}</h2>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {socials.map((s) => (
                    <li key={s.key}>
                      <ExternalLink href={s.href} label={`BluePure Marine op ${s.label}`} className="grid h-11 w-11 place-items-center rounded-full bg-sheet text-brand shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand hover:text-white">
                        {s.icon}
                      </ExternalLink>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <nav aria-label="Footermenu" className="grid grid-cols-2 gap-x-8 gap-y-9 md:grid-cols-3">
            {columns.map((c) => (
              <div key={c.label}>
                <h2 className="text-[1.05rem]">{c.label}</h2>
                <ul className="mt-2">
                  {(c.children ?? (c.href ? [c] : [])).map((item) => (
                    <li key={`${item.label}${item.href}`}>
                      <FooterLink item={item} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="col-span-2 md:col-span-1">
              <h2 className="text-[1.05rem]">{t.contact}</h2>
              <address className="mt-2 text-[0.95rem] not-italic">
                <p className="font-semibold text-ink">{site.name}</p>
                {address.map((line) => (
                  <p key={line}>{line}</p>
                ))}
                {site.email && (
                  <p className="mt-2">
                    <a href={`mailto:${site.email}`} className={`${linkCls} break-all`}>
                      {site.email}
                    </a>
                  </p>
                )}
                {site.phone && (
                  <p>
                    <a href={`tel:${site.phoneIntl || site.phone.replace(/[^+\d]/g, "")}`} className={linkCls}>
                      {site.phone}
                    </a>
                  </p>
                )}
                {site.whatsapp && (
                  <p>
                    <ExternalLink href={`https://wa.me/${site.whatsapp.replace(/\D/g, "")}`} className={`${linkCls} gap-1.5`}>
                      <WhatsAppIcon className="h-4 w-4 text-success" />
                      WhatsApp
                    </ExternalLink>
                  </p>
                )}
              </address>
            </div>
          </nav>
        </div>
      </div>

      {/* 3. betalen, copyright, juridisch */}
      <div className="bg-sheet">
        <div className="container-x flex flex-col gap-5 py-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-[0.88rem] font-semibold text-ink">{t.payments}</p>
            <PaymentBadges />
          </div>
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.88rem] text-muted lg:pr-20">
            {legal.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="inline-flex min-h-10 items-center underline-offset-4 hover:text-brand hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <CookieSettingsButton label={t.cookieSettings} />
            </li>
          </ul>
        </div>
        <div className="border-t border-rule">
          <p className="container-x flex flex-wrap gap-x-5 gap-y-1 pt-4 pb-24 text-[0.84rem] text-muted lg:pb-4">
            <span>{fmt(t.rights, { year: new Date().getFullYear(), name: site.legalName || site.name })}</span>
            {site.kvk && <span>{fmt(t.kvk, { kvk: site.kvk })}</span>}
            {site.vat && <span>{fmt(t.vat, { vat: site.vat })}</span>}
          </p>
        </div>
      </div>
    </footer>
  );
}
