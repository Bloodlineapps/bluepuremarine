import type { Page } from "@prisma/client";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { parseBlocks, type Block } from "@/lib/blocks";
import { childrenOf, faqsFor, pagePaths } from "@/lib/content";
import { crumbsFor } from "@/lib/crumbs";
import { db } from "@/lib/db";
import { parseSteps } from "@/lib/forms";
import { dict, fmt } from "@/lib/i18n";
import { breadcrumbLd, describe, faqLd, graph, webPageLd } from "@/lib/seo";
import { getSite, type SiteSettings } from "@/lib/settings";
import { formatDate, plain } from "@/lib/text";
import { Breadcrumbs } from "./Breadcrumbs";
import { ExternalLink } from "./ExternalLink";
import { FormRenderer } from "./Forms";
import { Html } from "./Html";
import { JsonLd } from "./JsonLd";
import { WhatsAppIcon } from "./icons";
import { Accordion } from "./ui";

// Weergave van een CMS-pagina (tabel Page): kruimelpad, H1, inleiding en daaronder de blokken uit de editor.
// Templates: "faq" toont de veelgestelde vragen per categorie (met FAQPage structured data), "contact" de
// contactgegevens met het contactformulier, "legal" een rustige tekstpagina. Het beheer gebruikt deze component
// ook voor de voorbeeldweergave.

type FaqRow = { id: string; question: string; answer: string; category: string };
type Child = { path: string; title: string; navTitle: string; summary: string; heroImage: string | null; heroAlt: string };

export async function PageView({ page }: { page: Page }) {
  const t = dict("nl");
  const blocks = parseBlocks(page.blocks);
  const isFaq = page.template === "faq";
  const isContact = page.template === "contact";
  const isLegal = page.template === "legal";
  const hasFaqBlock = blocks.some((b) => b.type === "faq");
  const hasFormBlock = blocks.some((b) => b.type === "form");
  const [site, crumbs, faqs, children, paths, contactForm] = await Promise.all([
    getSite(),
    crumbsFor(page),
    isFaq || hasFaqBlock ? faqsFor() : Promise.resolve([]),
    blocks.some((b) => b.type === "children") ? childrenOf(page.translationKey) : Promise.resolve([]),
    pagePaths(),
    isContact && !hasFormBlock ? db.form.findFirst({ where: { key: "contact", status: "published", deletedAt: null } }) : Promise.resolve(null),
  ]);
  const description = describe(page.metaDescription, page.intro);
  const narrow = isLegal ? "max-w-[78ch]" : "";

  return (
    <>
      <JsonLd data={graph(webPageLd({ path: page.path, title: page.title, description, image: page.heroImage, modified: page.updatedAt }), breadcrumbLd(crumbs), isFaq && faqs.length > 0 && faqLd(faqs))} />

      <header className="border-b border-rule bg-paper">
        <div className="container-x py-6 lg:py-9">
          <Breadcrumbs items={crumbs} />
          <div className={`mt-4 grid items-center gap-8 ${page.heroImage ? "lg:grid-cols-[1.2fr_1fr]" : ""}`}>
            <div>
              <h1 className="h-display max-w-[22ch] text-[length:var(--text-hero)] text-navy">{page.title}</h1>
              {page.intro && <p className="mt-4 max-w-[68ch] text-[length:var(--text-lede)]">{page.intro}</p>}
            </div>
            {page.heroImage && (
              <div className="relative aspect-[16/10] overflow-hidden rounded-card">
                <Image src={page.heroImage} alt={page.heroAlt} width={1280} height={800} priority sizes="(min-width: 1024px) 40vw, 92vw" className="absolute inset-0 h-full w-full object-cover" />
              </div>
            )}
          </div>
        </div>
      </header>

      {page.isDraftCopy && (
        <div className="container-x pt-6">
          <p className={`rounded-lg border-l-4 border-sun bg-sun-100 px-4 py-3 text-[0.94rem] text-ink ${narrow}`}>{t.page.draftCopy}</p>
        </div>
      )}

      {isContact && <ContactDetails site={site} faqHref={paths.faq} />}

      <div className={isLegal ? "container-x" : ""}>
        <div className={narrow}>
          {blocks.map((b) => (
            <BlockView key={b.id} block={b} faqs={faqs} childCards={children} paths={paths} flat={isLegal} />
          ))}
        </div>
      </div>

      {isFaq && !hasFaqBlock && faqs.length > 0 && (
        <section className="container-x py-[var(--spacing-section-sm)]">
          <FaqGroups faqs={faqs} />
        </section>
      )}

      {contactForm && (
        <section id="formulier" className="container-x scroll-mt-4 py-[var(--spacing-section-sm)]">
          <div className="card mx-auto max-w-3xl p-5 sm:p-8">
            <h2 className="text-[length:var(--text-title)]">Stuur ons een bericht</h2>
            <div className="mt-5">
              <FormRenderer formKey={contactForm.key} steps={parseSteps(contactForm.steps)} submitLabel={contactForm.submitLabel} />
            </div>
          </div>
        </section>
      )}

      {isLegal && (
        <div className="container-x pb-4">
          <p className="text-[0.9rem] text-muted">{fmt(t.page.lastUpdated, { date: formatDate(page.updatedAt) })}</p>
        </div>
      )}
    </>
  );
}

// ---------- contact ----------

function ContactDetails({ site, faqHref }: { site: SiteSettings; faqHref?: string }) {
  const tel = site.phoneIntl || site.phone.replace(/[^+\d]/g, "");
  const address = [site.street, [site.postalCode, site.city].filter(Boolean).join(" ")].filter(Boolean);
  const item = "card card-hover flex h-full items-start gap-4 p-5";
  const icon = "grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-50 text-brand";
  return (
    <section className="container-x pt-[var(--spacing-section-sm)]" aria-labelledby="contactgegevens">
      <h2 id="contactgegevens" className="text-[length:var(--text-title)]">
        Contactgegevens
      </h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {site.phone && (
          <li>
            <a href={`tel:${tel}`} className={item}>
              <span className={icon}>
                <Icon name="phone" className="h-6 w-6" />
              </span>
              <span>
                <span className="block font-bold text-ink">Bellen</span>
                <span className="whitespace-nowrap">{site.phone}</span>
                {site.serviceHours && <span className="block text-[0.86rem] text-muted">{site.serviceHours}</span>}
              </span>
            </a>
          </li>
        )}
        {site.whatsapp && (
          <li>
            <ExternalLink href={`https://wa.me/${site.whatsapp.replace(/\D/g, "")}${site.whatsappText ? `?text=${encodeURIComponent(site.whatsappText)}` : ""}`} className={item}>
              <span className={`${icon} bg-success-100 text-success`}>
                <WhatsAppIcon className="h-6 w-6" />
              </span>
              <span>
                <span className="block font-bold text-ink">WhatsApp</span>
                <span>Stuur ons een bericht</span>
              </span>
            </ExternalLink>
          </li>
        )}
        {site.email && (
          <li>
            <a href={`mailto:${site.email}`} className={item}>
              <span className={icon}>
                <Icon name="mail" className="h-6 w-6" />
              </span>
              <span>
                <span className="block font-bold text-ink">Mailen</span>
                <span>{site.email}</span>
              </span>
            </a>
          </li>
        )}
        {address.length > 0 && (
          <li className="card flex items-start gap-4 p-5">
            <span className={icon}>
              <Icon name="pin" className="h-6 w-6" />
            </span>
            <address className="not-italic">
              <span className="block font-bold text-ink">{site.name}</span>
              {address.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
              {(site.kvk || site.vat) && (
                <span className="mt-1 block text-[0.86rem] text-muted">
                  {[site.kvk && `KvK ${site.kvk}`, site.vat && `Btw ${site.vat}`].filter(Boolean).join(" · ")}
                </span>
              )}
            </address>
          </li>
        )}
      </ul>
      {faqHref && (
        <p className="mt-4">
          Staat je vraag er misschien al bij?{" "}
          <Link href={faqHref} className="link">
            Bekijk de veelgestelde vragen
          </Link>
          .
        </p>
      )}
    </section>
  );
}

// ---------- veelgestelde vragen ----------

async function FaqGroups({ faqs }: { faqs: FaqRow[] }) {
  const groups: { title: string; items: FaqRow[] }[] = [];
  for (const f of faqs) (groups.find((g) => g.title === f.category) ?? groups[groups.push({ title: f.category, items: [] }) - 1]).items.push(f);
  const single = groups.length === 1;
  return (
    <div className="mx-auto max-w-4xl space-y-10">
      {groups.map((g) => (
        <section key={g.title}>
          {!single && <h2 className="h-display text-[1.7rem] text-navy">{g.title}</h2>}
          <div className={`border-t-2 border-navy ${single ? "" : "mt-3"}`}>
            {g.items.map((f) => (
              <Accordion key={f.id} title={f.question} level={single ? "h2" : "h3"}>
                <Html html={f.answer} className="max-w-[75ch]" />
              </Accordion>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ---------- blokken ----------

const H2 = "text-[length:var(--text-section)]";

async function BlockView({ block: b, faqs, childCards, paths, flat }: { block: Block; faqs: FaqRow[]; childCards: Child[]; paths: Record<string, string>; flat: boolean }) {
  // `flat`: juridische pagina's zijn één smalle tekstkolom (de container staat er al omheen)
  const wrap = flat ? "py-5" : "container-x py-[var(--spacing-section-sm)]";
  switch (b.type) {
    case "section": {
      if (flat || b.layout === "wide")
        return (
          <section className={wrap}>
            {b.heading && <h2 className={flat ? "text-[1.5rem]" : `${H2} max-w-[28ch]`}>{b.heading}</h2>}
            <Html html={b.html} className={`max-w-[80ch] ${b.heading ? "mt-4" : ""}`} />
          </section>
        );
      if (b.layout === "band")
        return (
          <section className="on-dark my-[var(--spacing-section-sm)] bg-navy py-[var(--spacing-section)] text-night-ink">
            <div className="container-x grid gap-6 lg:grid-cols-12 lg:gap-10">
              {b.heading && <h2 className="h-display text-[length:var(--text-section)] text-white lg:col-span-5">{b.heading}</h2>}
              <div className={b.heading ? "lg:col-span-7" : "lg:col-span-9"}>
                <Html html={b.html} className="on-dark" />
              </div>
            </div>
          </section>
        );
      if (b.layout === "image" && b.image)
        return (
          <section className={wrap}>
            <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
              <div className="relative aspect-[4/3] overflow-hidden rounded-card">
                <Image src={b.image} alt={b.imageAlt ?? ""} width={1200} height={900} sizes="(min-width: 1024px) 44vw, 92vw" className="absolute inset-0 h-full w-full object-cover" />
              </div>
              <div>
                {b.heading && <h2 className={H2}>{b.heading}</h2>}
                <Html html={b.html} className="mt-4" />
              </div>
            </div>
          </section>
        );
      return (
        <section className={wrap}>
          <div className="grid gap-4 lg:grid-cols-12 lg:gap-10">
            {b.heading && <h2 className={`${H2} lg:col-span-4`}>{b.heading}</h2>}
            <div className={b.heading ? "lg:col-span-8" : "lg:col-span-9"}>
              <Html html={b.html} className="max-w-[75ch]" />
            </div>
          </div>
        </section>
      );
    }
    case "text":
      return (
        <section className={wrap}>
          <Html html={b.html} className="max-w-[80ch]" />
        </section>
      );
    case "image":
      return b.src ? (
        <figure className={wrap}>
          <div className="relative aspect-[16/9] overflow-hidden rounded-card bg-paper-2">
            <Image src={b.src} alt={b.alt} width={1280} height={720} sizes="(min-width: 1344px) 1344px, 100vw" className="absolute inset-0 h-full w-full object-cover" />
          </div>
          {b.caption && <figcaption className="mt-2 text-[0.9rem] text-muted">{b.caption}</figcaption>}
        </figure>
      ) : null;
    case "buttons": {
      const items = b.items.filter((i) => i.label && i.href);
      if (!items.length) return null;
      return (
        <div className={`${flat ? "py-4" : "container-x pb-8"} flex flex-wrap gap-3`}>
          {items.map((i, n) =>
            /^https?:\/\//.test(i.href) ? (
              <ExternalLink key={n} href={i.href} className={i.style === "secondary" ? "btn-secondary" : "btn-primary"}>
                {i.label}
              </ExternalLink>
            ) : (
              <Link key={n} href={i.href} className={i.style === "secondary" ? "btn-secondary" : "btn-primary"}>
                {i.label}
              </Link>
            ),
          )}
        </div>
      );
    }
    case "cards":
      return <Cards heading={b.heading} wrap={wrap} items={b.items.map((i) => ({ title: i.title, html: i.html, href: (i.key && paths[i.key]) || i.href }))} />;
    case "children":
      return <Cards heading={b.heading} wrap={wrap} items={childCards.map((c) => ({ title: c.navTitle || c.title, html: c.summary ? `<p>${c.summary}</p>` : "", href: c.path }))} />;
    case "faq":
      if (!faqs.length) return null;
      return (
        <section className={wrap}>
          {(b.heading || b.html) && (
            <div className="mx-auto mb-6 max-w-4xl">
              {b.heading && <h2 className={H2}>{b.heading}</h2>}
              {b.html && <Html html={b.html} className="mt-3" />}
            </div>
          )}
          <FaqGroups faqs={faqs} />
        </section>
      );
    case "logos": {
      const items = b.items.filter((l) => l.src);
      if (!items.length) return null;
      return (
        <section className={wrap}>
          {b.heading && <h2 className={`${H2} mb-5`}>{b.heading}</h2>}
          <ul className="grid grid-cols-2 items-center gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {items.map((l) => {
              const img = <Image src={l.src} alt={l.alt} width={200} height={90} unoptimized={l.src.endsWith(".svg")} className="mx-auto max-h-14 w-auto object-contain" />;
              return (
                <li key={l.src} className="card grid h-24 place-items-center p-4">
                  {l.href ? (
                    /^https?:\/\//.test(l.href) ? (
                      <ExternalLink href={l.href}>{img}</ExternalLink>
                    ) : (
                      <Link href={l.href}>{img}</Link>
                    )
                  ) : (
                    img
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      );
    }
    case "form": {
      const form = await db.form.findFirst({ where: { key: b.formKey, status: "published", deletedAt: null } });
      if (!form) return null;
      return (
        <section id="formulier" className={`${wrap} scroll-mt-4`}>
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-4">
              {b.heading && <h2 className="text-[length:var(--text-title)]">{b.heading}</h2>}
              {b.html && <Html html={b.html} className="mt-3" />}
            </div>
            <div className="card p-5 sm:p-8 lg:col-span-8">
              <FormRenderer formKey={form.key} steps={parseSteps(form.steps)} submitLabel={form.submitLabel} />
              {b.note && <Html html={b.note} className="mt-5 text-[0.92rem] text-muted" />}
            </div>
          </div>
        </section>
      );
    }
    case "cta": {
      const text = plain(b.html);
      if (!text && !b.label) return null;
      return (
        <section className={flat ? "py-6" : "container-x py-[var(--spacing-section-sm)]"}>
          <div className="flex flex-col items-start gap-5 rounded-card bg-linear-to-br from-brand-700 via-brand to-brand-600 p-6 text-white sm:p-10 lg:flex-row lg:items-center lg:justify-between">
            {text && <h2 className="h-display max-w-[30ch] text-[length:var(--text-section)] text-white">{text}</h2>}
            {b.label && b.href && (
              <Link href={b.href} className="btn-light btn-lg shrink-0">
                {b.label}
                <Icon name="arrow" className="h-5 w-5" strokeWidth={2.4} />
              </Link>
            )}
          </div>
        </section>
      );
    }
  }
}

function Cards({ heading, items, wrap }: { heading: string; items: { title: string; html: string; href: string }[]; wrap: string }) {
  if (!items.length) return null;
  return (
    <section className={wrap}>
      {heading && <h2 className={`${H2} mb-5`}>{heading}</h2>}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => (
          <li key={`${i.href}${i.title}`}>
            <article className="card card-hover group relative flex h-full flex-col p-5">
              {heading ? (
                <h3 className="text-[1.1rem]">{i.href ? <CardLink href={i.href}>{i.title}</CardLink> : i.title}</h3>
              ) : (
                <h2 className="text-[1.1rem]">{i.href ? <CardLink href={i.href}>{i.title}</CardLink> : i.title}</h2>
              )}
              {i.html && <p className="mt-2 flex-1 text-[0.95rem]">{plain(i.html)}</p>}
              {i.href && <Icon name="arrow" className="mt-4 h-5 w-5 text-brand transition-transform duration-300 group-hover:translate-x-1" strokeWidth={2.2} />}
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  const cls = "after:absolute after:inset-0 after:content-[''] hover:text-brand";
  return /^https?:\/\//.test(href) ? (
    <ExternalLink href={href} className={cls}>
      {children}
    </ExternalLink>
  ) : (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}
