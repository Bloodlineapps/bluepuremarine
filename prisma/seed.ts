// Vult de database van BluePure Marine met de content uit content/*.json (gemaakt door scripts/parse.mjs en
// scripts/download-images.mjs), de concept-juridische teksten (prisma/legal.ts) en de blogartikelen (prisma/blog.ts).
//
// Gebruik: npm run db:seed            → webshop-content leegmaken en opnieuw vullen
//          npm run db:seed -- --if-empty → niets doen als er al producten zijn (productie-builds)
//
// Leeggemaakt en opnieuw gevuld: merken, categorieën, producten, reviews, pagina's, veelgestelde vragen, redirects,
// media, revisies, blog en de instellingen `menus` en `reviews`. Blijven staan: gebruikers (worden bijgewerkt vanuit
// .env), klanten, bestellingen, nieuwsbriefaanmeldingen, formulieren met hun inzendingen, logboeken en de overige
// instellingen (connecties en bedrijfsgegevens worden alleen aangemaakt als ze nog niet bestaan).
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { LEGAL, TERMS_SUPPLEMENT } from "./legal";
import { BLOG_CATEGORY, POSTS } from "./blog";

const db = new PrismaClient();
const root = path.resolve(__dirname, "..");
const read = <T,>(name: string): T => JSON.parse(fs.readFileSync(path.join(root, "content", `${name}.json`), "utf8")) as T;

// .env inlezen als die er is (lokaal); op Replit staan de variabelen als secrets in de omgeving
const envFile = path.join(root, ".env");
for (const line of fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8").split(/\r?\n/) : []) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/.exec(line);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}

// ---------- types van content/*.json ----------
type Img = { src: string; alt: string };
type ProductJson = {
  slug: string; sourceHandle: string; path: string; name: string; subtitle: string; lead: string; description: string; usage: string;
  specs: { label: string; value: string }[]; images: Img[]; productType: string; vendor: string; brandSlug: string | null;
  primaryCategory: string | null; categories: { path: string; position: number }[]; featured: boolean; price: number; compareAtPrice: number | null;
  sku: string | null; ean: string | null; weight: number; available: boolean; stock: number; publishedAt: string; metaTitle: string; metaDescription: string;
};
type CategoryJson = {
  path: string; slug: string; name: string; navTitle: string; parentPath: string | null; menuGroup: string; sourceHandle: string | null; highlight: boolean;
  sortOrder: number; intro: string; description: string; image: string | null; imageAlt: string; metaTitle: string; metaDescription: string;
};
type BrandJson = { slug: string; name: string; sourceVendor: string; logo: string | null; count: number; sortOrder: number };
type PageJson = {
  source: string; key: string; path: string | null; title: string; html: string; intro?: string; updatedAt: string | null;
  contact?: { heading: string; intro: string; subjects: string[]; messageLabel: string; note: string; submitLabel: string; company: Record<string, string[]>; image: string | null };
  help?: { heading: string; text: string };
};
type HomeJson = { about: { eyebrow: string; heading: string; html: string }[]; advice: { heading: string; text: string }; brands: { title: string; sub: string }; ownBrand: { title: string; text: string } };
type ImageJson = { src: string; dest: string; alt: string; folder: string; width?: number | null; height?: number | null; size?: number | null };
type ReviewJson = { name: string; rating: number; title: string; text: string; date: string; verified: boolean; productSlug: string | null };
type Block = Record<string, unknown> & { id: string; type: string };

const SUFFIX = " | BluePure Marine";
const EMAIL = "info@bluepuremarine.com";
const warnings: string[] = [];
const titles = new Map<string, string>();
/** Controle op de SEO-afspraken: title 45–60 tekens en uniek, description 140–160 tekens. */
function checkMeta(id: string, title: string | null, description: string | null) {
  if (title) {
    if (title.length < 45 || title.length > 60) warnings.push(`meta-title ${title.length} tekens (${id}): ${title}`);
    if (!title.endsWith(SUFFIX)) warnings.push(`meta-title eindigt niet op "${SUFFIX.trim()}" (${id})`);
    if (titles.has(title)) warnings.push(`dubbele meta-title "${title}" (${id} en ${titles.get(title)})`);
    titles.set(title, id);
  }
  if (description && (description.length < 140 || description.length > 160)) warnings.push(`meta-description ${description.length} tekens (${id}): ${description}`);
}
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');

/** HTML van een oude pagina → blokken: elke H2 wordt een sectie; tekst ervoor een tekstblok. */
function toBlocks(key: string, html: string, layout: "split" | "wide" = "split"): Block[] {
  const parts = html.replace(/^<h3>([^<]+)<\/h3>/, "<h2>$1</h2>").split(/(?=<h2>)/).filter((p) => p.trim());
  const blocks: Block[] = [];
  parts.forEach((p, i) => {
    const m = /^<h2>(.*?)<\/h2>/.exec(p);
    const body = m ? p.slice(m[0].length) : p;
    if (!body.trim()) return; // kop zonder tekst (bv. de titel van het document zelf)
    blocks.push(m ? { id: `${key}${i}`, type: "section", heading: decode(m[1]), html: body, layout } : { id: `${key}${i}`, type: "text", html: body });
  });
  return blocks;
}

// Contactformulier met de velden en onderwerpen van het formulier op de oude site.
const contactForm = (subjects: string[], messageLabel: string, submitLabel: string) => ({
  key: "contact",
  name: "Contact",
  description: "Contactformulier op /contact/.",
  submitLabel: submitLabel || "Verstuur bericht",
  successMessage: "Bedankt voor je bericht! We komen er zo snel mogelijk op terug.",
  notifySubject: "Nieuw bericht via de website: {onderwerp}",
  confirmEnabled: true,
  confirmSubject: "We hebben je bericht ontvangen",
  confirmText: `Hallo {naam},\n\nBedankt voor je bericht. We hebben het ontvangen en komen er zo snel mogelijk op terug.\n\nMet vriendelijke groet,\nBluePure Marine\n${EMAIL}\n+31 6 11791623`,
  steps: [
    {
      id: "s1",
      title: "Je bericht",
      fields: [
        { id: "naam", type: "text", label: "Naam", required: true, autocomplete: "name", max: 120 },
        { id: "email", type: "email", label: "E-mailadres", required: true, autocomplete: "email" },
        { id: "telefoon", type: "tel", label: "Telefoonnummer (optioneel)", required: false, autocomplete: "tel" },
        { id: "onderwerp", type: "select", label: "Onderwerp", placeholder: "Kies een onderwerp", required: true, options: subjects.length ? subjects : ["Vraag over een product", "Mijn bestelling", "Retourneren", "Iets anders"] },
        { id: "bericht", type: "textarea", label: messageLabel || "Waarmee kunnen we je helpen?", required: true, min: 10, max: 4000 },
      ],
    },
  ],
});

/** Vult een korte basiszin aan met vaste slotzinnen tot 140–160 tekens. */
function fitDescription(base: string, tails: string[]) {
  if (base.length >= 140) return base.length <= 160 ? base : `${base.slice(0, base.lastIndexOf(" ", 158))}…`;
  const combos: string[][] = [];
  for (const a of tails) combos.push([a]);
  for (const a of tails) for (const b of tails) if (a !== b) combos.push([a, b]);
  for (const a of tails) for (const b of tails) for (const c of tails) if (a !== b && b !== c && a !== c) combos.push([a, b, c]);
  for (const c of combos) {
    const next = `${base} ${c.join(" ")}`;
    if (next.length >= 140 && next.length <= 160) return next;
  }
  return base;
}

async function main() {
  // ---------- rollen en beheeraccounts ----------
  const roles = [
    { key: "superadmin", name: "Superadmin" },
    { key: "admin", name: "Beheerder" },
    { key: "user", name: "Gebruiker" },
  ];
  for (const r of roles) await db.role.upsert({ where: { key: r.key }, create: r, update: { name: r.name } });
  const roleId = async (key: string) => (await db.role.findUniqueOrThrow({ where: { key } })).id;
  for (const [envUser, envPass, role, name] of [
    ["SUPERADMIN_EMAIL", "SUPERADMIN_PASSWORD", "superadmin", "Bart Rinsma"],
    ["ADMIN_EMAIL", "ADMIN_PASSWORD", "admin", "Beheerder BluePure"],
    ["USER_EMAIL", "USER_PASSWORD", "user", "Medewerker BluePure"],
  ] as const) {
    const email = process.env[envUser]?.trim().toLowerCase();
    const pass = process.env[envPass];
    if (!email || !pass) {
      console.log(`Let op: ${envUser}/${envPass} ontbreekt, account "${name}" niet aangemaakt.`);
      continue;
    }
    const found = await db.user.findUnique({ where: { email } });
    // bestaande accounts houden hun wachtwoord (kan in het beheer gewijzigd zijn); alleen rol en naam worden gelijkgetrokken
    if (found) await db.user.update({ where: { email }, data: { roleId: await roleId(role) } });
    else await db.user.create({ data: { email, name, passwordHash: await bcrypt.hash(pass, 11), roleId: await roleId(role) } });
  }

  // ---------- testklant ----------
  {
    const email = process.env.CUSTOMER_EMAIL?.trim().toLowerCase();
    const pass = process.env.CUSTOMER_PASSWORD;
    if (email && pass && !(await db.customer.findUnique({ where: { email } }))) {
      await db.customer.create({
        data: {
          email,
          passwordHash: await bcrypt.hash(pass, 11),
          firstName: "Test",
          lastName: "Klant",
          phone: "",
          addresses: { create: { type: "shipping", firstName: "Test", lastName: "Klant", street: "Teststraat", houseNumber: "1", postalCode: "1234 AB", city: "Teststad", country: "NL", isDefault: true } },
        },
      });
    }
  }

  // --if-empty: alleen vullen als er nog geen producten zijn (veilig bij elke deploy; overschrijft nooit beheerwerk)
  if (process.argv.includes("--if-empty") && (await db.product.count()) > 0) {
    console.log("Database bevat al producten: niets gewijzigd (--if-empty).");
    return;
  }

  console.log("Content leegmaken…");
  await db.productCategory.deleteMany();
  await db.variant.deleteMany();
  await db.review.deleteMany();
  await db.product.deleteMany();
  await db.category.deleteMany({ where: { parentId: { not: null } } });
  await db.category.deleteMany();
  await db.brand.deleteMany();
  await db.post.deleteMany();
  await db.blogCategory.deleteMany();
  await db.$transaction([db.page.deleteMany(), db.faq.deleteMany(), db.redirect.deleteMany(), db.media.deleteMany(), db.revision.deleteMany()]);

  const products = read<ProductJson[]>("products");
  const categories = read<CategoryJson[]>("categories");
  const brands = read<BrandJson[]>("brands");
  const { pages, home } = read<{ pages: PageJson[]; home: HomeJson }>("pages");
  const images = read<ImageJson[]>("images");
  const imageByDest = new Map(images.map((i) => [i.dest, i]));
  const onDisk = (p: string) => fs.existsSync(path.join(root, "public", p));

  // ---------- media ----------
  for (const im of images) {
    if (!onDisk(im.dest)) {
      warnings.push(`afbeelding ontbreekt op schijf: ${im.dest} (draai npm run images)`);
      continue;
    }
    await db.media.create({ data: { path: im.dest, alt: im.alt, folder: im.folder, width: im.width ?? null, height: im.height ?? null, size: im.size ?? fs.statSync(path.join(root, "public", im.dest)).size } });
  }

  // ---------- merken ----------
  const brandId = new Map<string, string>();
  for (const b of brands) {
    const types = [...new Set(products.filter((p) => p.brandSlug === b.slug).map((p) => p.productType.toLowerCase()).filter(Boolean))];
    const own = b.slug === "bluepure-marine";
    const rest = b.sourceVendor === "Overig";
    const titleBase = own ? "BluePure reinigingslijn voor je boot" : rest ? "Overige merken: bootonderdelen en meer" : [`${b.name}: onderdelen en producten`, `${b.name} bootonderdelen en producten kopen`, `${b.name} onderdelen en producten voor je boot`].find((t) => t.length >= 27 && t.length <= 42) ?? `${b.name} producten voor je boot`;
    const list = types.length > 1 ? `${types.slice(0, -1).join(", ")} en ${types[types.length - 1]}` : types[0] ?? "producten";
    const descBase = own
      ? "De eigen reinigingslijn van BluePure Marine: reinigers voor romp, dek, kajuit en schroef, met bijpassende borstels, doeken en pakketten."
      : rest
        ? "Producten zonder merknaam bij BluePure Marine: ankers, boegschroeven en opblaasboten."
        : `${b.name} bij BluePure Marine: ${list}.`;
    const metaTitle = titleBase + SUFFIX;
    const metaDescription = fitDescription(descBase, ["Gratis verzending vanaf € 75.", "Met persoonlijk advies als je twijfelt wat past.", "Bekijk het aanbod en bestel online.", "14 dagen bedenktijd.", "Bestel online bij BluePure Marine."]);
    checkMeta(`merk ${b.slug}`, metaTitle, metaDescription);
    const row = await db.brand.create({
      data: { slug: b.slug, name: b.name, logo: b.logo && onDisk(b.logo) ? b.logo : null, description: own ? `<p>${home.ownBrand.text}</p>` : "", sortOrder: b.sortOrder, metaTitle, metaDescription },
    });
    brandId.set(b.slug, row.id);
  }

  // ---------- categorieën (hoofdcategorieën eerst) ----------
  const categoryId = new Map<string, string>();
  for (const c of [...categories].sort((a, b) => Number(!!a.parentPath) - Number(!!b.parentPath))) {
    checkMeta(c.path, c.metaTitle, c.metaDescription);
    const row = await db.category.create({
      data: {
        path: c.path,
        slug: c.slug,
        name: c.name,
        navTitle: c.navTitle,
        parentId: c.parentPath ? categoryId.get(c.parentPath)! : null,
        menuGroup: c.menuGroup,
        intro: c.intro,
        description: c.description,
        image: c.image && onDisk(c.image) ? c.image : null,
        imageAlt: c.imageAlt,
        sourceHandle: c.sourceHandle,
        highlight: c.highlight,
        sortOrder: c.sortOrder,
        metaTitle: c.metaTitle,
        metaDescription: c.metaDescription,
      },
    });
    categoryId.set(c.path, row.id);
  }

  // ---------- producten ----------
  const productId = new Map<string, string>();
  for (const [i, p] of products.entries()) {
    checkMeta(p.slug, p.metaTitle, p.metaDescription);
    const imgs = p.images.filter((im) => onDisk(im.src)).map((im) => ({ src: im.src, alt: im.alt, width: imageByDest.get(im.src)?.width ?? undefined, height: imageByDest.get(im.src)?.height ?? undefined }));
    if (!imgs.length) warnings.push(`product zonder afbeelding op schijf: ${p.slug}`);
    if (!p.primaryCategory || !categoryId.has(p.primaryCategory)) warnings.push(`product zonder primaire categorie: ${p.slug}`);
    const row = await db.product.create({
      data: {
        slug: p.slug,
        path: p.path,
        name: p.name,
        subtitle: p.subtitle,
        lead: p.lead,
        description: p.description,
        usage: p.usage,
        specs: JSON.stringify(p.specs),
        images: JSON.stringify(imgs),
        productType: p.productType,
        brandId: p.brandSlug ? brandId.get(p.brandSlug) ?? null : null,
        primaryCategoryId: p.primaryCategory ? categoryId.get(p.primaryCategory) ?? null : null,
        price: p.price,
        compareAtPrice: p.compareAtPrice,
        vatRate: 21,
        sku: p.sku,
        ean: p.ean,
        // de feed geeft alleen "beschikbaar": 25 stuks als aanname, of het aantal dat de oude productpagina noemde ("Nog 2 op voorraad")
        stock: p.stock,
        trackStock: true,
        weight: p.weight,
        featured: p.featured,
        sortOrder: i,
        metaTitle: p.metaTitle,
        metaDescription: p.metaDescription,
        sourceHandle: p.sourceHandle,
        publishedAt: new Date(p.publishedAt),
        categories: { create: p.categories.filter((c) => categoryId.has(c.path)).map((c) => ({ categoryId: categoryId.get(c.path)!, position: c.position })) },
      },
    });
    productId.set(p.slug, row.id);
  }

  // ---------- reviews (overgenomen van de oude site) ----------
  for (const r of read<ReviewJson[]>("reviews")) {
    await db.review.create({
      data: { productId: r.productSlug ? productId.get(r.productSlug) ?? null : null, name: r.name, rating: r.rating, title: r.title, text: r.text, status: "approved", verified: r.verified, source: "import", date: new Date(r.date), createdAt: new Date(r.date) },
    });
  }

  // ---------- pagina's ----------
  const page = (key: string) => pages.find((p) => p.key === key);
  const need = (key: string) => {
    const p = page(key);
    if (!p) throw new Error(`Pagina ${key} ontbreekt in content/pages.json`);
    return p;
  };
  const contact = need("contact");
  const c = contact.contact!;
  const faqPage = need("faq");
  const terms = need("policy:terms-of-service");
  const legalNotice = need("policy:legal-notice");
  const mailLink = `<a href="mailto:${EMAIL}">${EMAIL}</a>`;
  const companyHtml = Object.entries(c.company)
    .map(([label, lines]) => `<p><strong>${label}</strong><br>${lines.map((l) => (l.includes("@") ? mailLink : /^\+\d/.test(l) ? `<a href="tel:${l.replace(/[^+\d]/g, "")}">${l}</a>` : l)).join("<br>")}</p>`)
    .join("");
  const logoItems = brands.filter((b) => b.logo && b.slug !== "bluepure-marine" && onDisk(b.logo)).map((b) => ({ src: b.logo!, alt: `Logo ${b.name}`, href: `/merken/${b.slug}/` }));

  type PageDef = {
    key: string; path: string; title: string; navTitle?: string; intro: string; template: string; section: string; summary?: string; blocks: Block[];
    metaTitle: string; metaDescription: string; heroImage?: string | null; heroAlt?: string; ctaLabel?: string | null; isDraftCopy?: boolean; noindex?: boolean; updatedAt?: string | null;
  };
  const defs: PageDef[] = [
    {
      // de inhoud van de homepage komt uit de instelling `home` (src/lib/home.ts); deze rij levert de URL en de meta-tags
      key: "home", path: "/", title: "Onderhoudsmiddelen en bootonderdelen voor je boot", navTitle: "Home", template: "home", section: "home",
      intro: "Onderhoudsmiddelen en bootonderdelen van merken die je kunt vertrouwen. Snel verzonden, met persoonlijk advies.",
      blocks: [],
      metaTitle: "Bootreinigers en bootonderdelen online" + SUFFIX,
      metaDescription: "BluePure Marine levert onderhoudsmiddelen en bootonderdelen van merken die je kunt vertrouwen. Gratis verzending vanaf € 75 en persoonlijk advies uit Waspik.",
      heroImage: "/uploads/home/hero-producten.webp", heroAlt: "De reinigingslijn van BluePure Marine: flessen cleaner voor exterieur, interieur en schroef",
    },
    {
      key: "contact", path: "/contact/", title: c.heading || "Neem contact op", navTitle: "Contact", template: "contact", section: "overig",
      intro: "Stuur ons een bericht en we komen er zo snel mogelijk op terug. Bellen, appen of mailen kan ook.",
      blocks: [
        { id: "contact1", type: "form", heading: "Stuur een bericht", html: `<p>Stuur ons een bericht en we komen er zo snel mogelijk op terug. Mailen kan ook: ${mailLink}.</p>`, note: c.note, formKey: "contact" },
        { id: "contact2", type: "section", heading: "Bedrijfsgegevens", html: companyHtml, layout: "split" },
        { id: "contact3", type: "buttons", items: [{ label: "Veelgestelde vragen", href: "/veelgestelde-vragen/", style: "secondary" }, { label: "Retourneren", href: "/retourbeleid/", style: "secondary" }] },
      ],
      metaTitle: "Contact en bedrijfsgegevens" + SUFFIX,
      metaDescription: "Neem contact op met BluePure Marine in Waspik: stuur een bericht, bel of app +31 6 11791623 of mail info@bluepuremarine.com. We helpen je graag verder.",
      heroImage: c.image, heroAlt: "Boot op het water", ctaLabel: null,
    },
    {
      key: "klantenservice", path: "/klantenservice/", title: "Klantenservice", template: "default", section: "overig",
      intro: "Hulp nodig bij je bestelling, een retour of het kiezen van het juiste product? Hier vind je alles op één plek.",
      blocks: [
        ...toBlocks("ks", need("klantenservice").html.replace(/<p>Email: [^<]*<\/p><p>Telefoon: [^<]*<\/p>/, `<p>E-mail: ${mailLink}<br>Telefoon en WhatsApp: <a href="tel:+31611791623">+31 6 11791623</a></p>`)),
        {
          id: "ks-cards", type: "cards", heading: "Waar kunnen we je mee helpen?",
          items: [
            { title: "Veelgestelde vragen", html: "<p>Antwoorden over bestellen, betalen, verzending, retourneren en het gebruik van de reinigers.</p>", href: "/veelgestelde-vragen/", key: "faq" },
            { title: "Verzending", html: "<p>Hoe we je bestelling verpakken en verzenden, en wanneer verzending gratis is.</p>", href: "/verzending/", key: "verzending" },
            { title: "Retourbeleid", html: "<p>Zo meld je een retour aan en stuur je een product terug.</p>", href: "/retourbeleid/", key: "retourbeleid" },
            { title: "Hoe wij bestellingen verwerken", html: "<p>Wat er gebeurt nadat je een bestelling plaatst of een vraag stelt.</p>", href: "/hoe-wij-de-bestellingen-en-contact-verwerken/", key: "bestellingen" },
            { title: "Contact", html: "<p>Stuur een bericht, bel of app ons. We denken graag met je mee.</p>", href: "/contact/", key: "contact" },
          ],
        },
      ],
      metaTitle: "Klantenservice: hulp bij je bestelling" + SUFFIX,
      metaDescription: "De klantenservice van BluePure Marine helpt je met vragen over je bestelling, verzending, retourneren en het kiezen van het juiste product of onderdeel.",
    },
    {
      key: "faq", path: "/veelgestelde-vragen/", title: "Veelgestelde vragen", template: "faq", section: "overig",
      intro: faqPage.intro || "Zoek je antwoord of kies hieronder een onderwerp.",
      blocks: [
        { id: "faq1", type: "faq", heading: "", html: faqPage.html },
        { id: "faq2", type: "cta", html: `<h2>${faqPage.help?.heading || "Staat je vraag er niet bij?"}</h2><p>${faqPage.help?.text || "Bel, app of mail ons. We helpen je graag verder."}</p>`, label: "Neem contact op", href: "/contact/" },
      ],
      metaTitle: "Veelgestelde vragen over bestellen" + SUFFIX,
      metaDescription: "Antwoord op veelgestelde vragen over bestellen en betalen, verzending, retourneren, het gebruik van de reinigers en het kiezen van onderdelen voor je boot.",
    },
    {
      key: "verzending", path: "/verzending/", title: "Verzending", template: "default", section: "overig",
      intro: "Zo verpakken en verzenden we je bestelling.",
      blocks: [
        ...toBlocks("vz", need("verzending").html),
        // tekst van het blok "Verzending en retour" op de oude productpagina's
        { id: "vz-kosten", type: "section", heading: "Verzendkosten", html: "<p>Verzendkosten zie je bij het afrekenen; vanaf € 75 verzenden we gratis. Zodra je bestelling onderweg is, krijg je een e-mail met de verzendgegevens.</p>", layout: "split" },
        { id: "vz-cta", type: "cta", html: '<p>Heb je je bestelling op een bepaald moment nodig? Neem vooraf even contact met ons op, dan kijken we wat er mogelijk is.</p>', label: "Neem contact op", href: "/contact/" },
      ],
      metaTitle: "Verzending en levertijd van je order" + SUFFIX,
      metaDescription: "Lees hoe BluePure Marine je bestelling verpakt en verzendt, wat de levertijd is, wanneer verzending gratis is en hoe je op de hoogte blijft van je zending.",
    },
    {
      key: "retourbeleid", path: "/retourbeleid/", title: "Retourbeleid", template: "default", section: "overig",
      intro: "Wil je een product terugsturen? Zo werkt het.",
      blocks: [
        ...toBlocks("rt", need("retourbeleid").html),
        // tekst van het blok "Verzending en retour" op de oude productpagina's
        { id: "rt-bedenktijd", type: "section", heading: "Bedenktijd", html: '<p>Je hebt 14 dagen bedenktijd. Meld je retour vooraf aan via <a href="/contact/">onze klantenservice</a>. Meer weten? Bekijk de <a href="/veelgestelde-vragen/#retourneren-en-klachten">veelgestelde vragen</a> of het herroepingsrecht in de <a href="/algemene-voorwaarden/">algemene voorwaarden</a>.</p>', layout: "split" },
      ],
      metaTitle: "Retourbeleid: zo stuur je iets terug" + SUFFIX,
      metaDescription: "Zo werkt retourneren bij BluePure Marine: retour aanmelden, zorgvuldig verpakken en terugsturen. Als consument heb je 14 dagen bedenktijd na ontvangst.",
    },
    {
      key: "bestellingen", path: "/hoe-wij-de-bestellingen-en-contact-verwerken/", title: "Hoe wij de bestellingen en contact verwerken", navTitle: "Hoe wij bestellingen verwerken", template: "default", section: "overig",
      intro: "Wat er gebeurt nadat je een bestelling plaatst of een vraag stelt.",
      blocks: toBlocks("bs", need("bestellingen").html),
      metaTitle: "Hoe wij bestellingen verwerken" + SUFFIX,
      metaDescription: "Lees hoe BluePure Marine je bestelling en je vragen verwerkt: zorgvuldig, met een duidelijke verzendtermijn en een volledig antwoord op elke vraag die je stelt.",
    },
    {
      key: "over-ons", path: "/over-ons/", title: "Over BluePure Marine", navTitle: "Over ons", template: "about", section: "over-ons",
      intro: "Onderhoudsmiddelen en bootonderdelen van merken die je kunt vertrouwen, vanuit Waspik en met persoonlijk advies.",
      blocks: [
        ...home.about.map((a, i) => ({ id: `about${i}`, type: "section", heading: a.heading, html: a.html, layout: "image", image: i === 0 ? "/uploads/home/jacht.webp" : "/uploads/home/kajuit.webp", imageAlt: i === 0 ? "Motorjacht op het water" : "Kajuit van een zeilboot" })),
        ...(logoItems.length ? [{ id: "about-logos", type: "logos", heading: home.brands.title || "Merken die je kent", items: logoItems }] : []),
        { id: "about-cta", type: "cta", html: `<h2>${home.advice.heading}</h2><p>${home.advice.text}</p>`, label: "Neem contact op", href: "/contact/" },
      ],
      metaTitle: "Over ons: reiniging uit de praktijk" + SUFFIX,
      metaDescription: "BluePure Marine uit Waspik heeft jarenlange ervaring met het reinigen en onderhouden van boten. Die kennis zit in onze eigen reinigingslijn en in ons advies.",
      heroImage: "/uploads/home/jacht.webp", heroAlt: "Motorjacht op het water",
    },
    ...LEGAL.map((l) => ({
      key: l.key, path: l.path, title: l.title, navTitle: l.navTitle, intro: l.intro, template: "legal", section: "juridisch", isDraftCopy: true,
      blocks: l.sections.map((s, i) => ({ id: `${l.key}${i}`, type: "section", heading: s.heading, html: s.html, layout: "split" })) as Block[],
      metaTitle: l.metaTitle, metaDescription: l.metaDescription,
    })),
    {
      // echte voorwaarden van de oude site + een concept-aanvulling voor consumenten (herroepingsrecht)
      key: "terms", path: "/algemene-voorwaarden/", title: "Algemene voorwaarden", template: "legal", section: "juridisch", isDraftCopy: true,
      intro: "De servicevoorwaarden van BluePure Marine, aangevuld met de bepalingen voor bestellingen via de webwinkel, waaronder het herroepingsrecht.",
      blocks: [...toBlocks("terms", terms.html), ...TERMS_SUPPLEMENT.map((s, i) => ({ id: `terms-web${i}`, type: "section", heading: s.heading, html: s.html, layout: "split" }))],
      metaTitle: "Algemene voorwaarden webwinkel" + SUFFIX,
      metaDescription: "De algemene voorwaarden van BluePure Marine voor diensten en bestellingen via de webwinkel, inclusief het herroepingsrecht van 14 dagen voor consumenten.",
    },
    {
      key: "legal", path: "/juridische-informatie/", title: "Juridische informatie", template: "legal", section: "juridisch",
      intro: "Bedrijfsgegevens en wettelijke informatie over deze website en webwinkel.",
      blocks: toBlocks("legal", legalNotice.html),
      metaTitle: "Juridische informatie en gegevens" + SUFFIX,
      metaDescription: "Bedrijfsgegevens en wettelijke informatie van BluePure Marine: adres, KvK- en btw-nummer, prijzen, intellectuele eigendom en het toepasselijk recht.",
    },
  ];
  const pagePaths = new Set<string>();
  for (const [i, p] of defs.entries()) {
    checkMeta(`pagina ${p.path}`, p.metaTitle, p.metaDescription);
    const source = pages.find((x) => x.path === p.path && x.updatedAt);
    const when = source?.updatedAt ? new Date(source.updatedAt) : new Date("2026-11-12T09:00:00Z");
    await db.page.create({
      data: {
        path: p.path,
        locale: "nl",
        translationKey: p.key,
        parentKey: p.key === "home" ? null : "home",
        title: p.title,
        navTitle: p.navTitle ?? "",
        intro: p.intro,
        heroImage: p.heroImage && onDisk(p.heroImage) ? p.heroImage : null,
        heroAlt: p.heroAlt ?? "",
        ctaLabel: p.ctaLabel ?? null,
        blocks: JSON.stringify(p.blocks),
        template: p.template,
        section: p.section,
        summary: p.summary ?? p.intro,
        isDraftCopy: !!p.isDraftCopy,
        sortOrder: i * 10,
        metaTitle: p.metaTitle,
        metaDescription: p.metaDescription,
        publishedAt: when,
        updatedAt: when,
      },
    });
    pagePaths.add(p.path);
  }

  // ---------- veelgestelde vragen ----------
  for (const f of read<{ category: string; question: string; answer: string; sortOrder: number }[]>("faqs")) {
    await db.faq.create({ data: { locale: "nl", question: f.question, answer: f.answer, category: f.category, sortOrder: f.sortOrder } });
  }

  // ---------- redirects van de oude URL's ----------
  const known = new Set<string>([...pagePaths, ...categories.map((x) => x.path), ...products.map((x) => x.path), "/winkelwagen/", "/zoeken/", "/account/inloggen/", "/account/registreren/"]);
  for (const r of read<{ from: string; to: string }[]>("redirects")) {
    if (!known.has(r.to)) warnings.push(`redirect ${r.from} wijst naar onbekend pad ${r.to}`);
    await db.redirect.create({ data: { from: r.from, to: r.to, status: 301 } });
  }

  // ---------- blog ----------
  const blogCategory = await db.blogCategory.create({ data: BLOG_CATEGORY });
  for (const post of POSTS) {
    const postPath = `/blog/${post.slug}/`;
    checkMeta(`blog ${post.slug}`, post.metaTitle, post.metaDescription);
    const links = [...post.content.matchAll(/href="(\/[^"#]*)/g)].map((m) => m[1]);
    for (const href of links) if (!known.has(href)) throw new Error(`Blog ${post.slug} linkt naar een pad dat niet bestaat: ${href}`);
    if (links.length < 3 || links.length > 5) warnings.push(`blog ${post.slug} heeft ${links.length} interne links (afspraak: 3–5)`);
    const words = post.content.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    if (words < 700 || words > 1000) warnings.push(`blog ${post.slug} telt ${words} woorden (afspraak: 700–1000)`);
    if (!onDisk(post.image)) warnings.push(`blog ${post.slug}: afbeelding ${post.image} ontbreekt`);
    await db.post.create({
      data: {
        slug: post.slug, path: postPath, title: post.title, excerpt: post.excerpt, content: post.content, image: onDisk(post.image) ? post.image : null, imageAlt: post.imageAlt,
        categoryId: blogCategory.id, tags: JSON.stringify(post.tags), authorName: "BluePure Marine", status: "published", metaTitle: post.metaTitle, metaDescription: post.metaDescription,
        publishedAt: new Date(post.publishedAt), createdAt: new Date(post.publishedAt),
      },
    });
  }

  // ---------- formulieren (alleen aanmaken als ze nog niet bestaan; inzendingen blijven staan) ----------
  const form = contactForm(c.subjects, c.messageLabel, c.submitLabel);
  if (!(await db.form.findUnique({ where: { key: form.key } }))) await db.form.create({ data: { ...form, steps: JSON.stringify(form.steps), notifyEmails: JSON.stringify([EMAIL]) } });

  // ---------- kortingscode voor testen ----------
  await db.discount.upsert({ where: { code: "WELKOM10" }, create: { code: "WELKOM10", type: "percent", value: 10, active: true }, update: { type: "percent", value: 10, active: true } });

  // ---------- instellingen ----------
  const setting = (key: string, value: unknown) => db.setting.upsert({ where: { key }, create: { key, value: JSON.stringify(value) }, update: { value: JSON.stringify(value) } });
  const settingIfMissing = async (key: string, value: unknown) => {
    if (!(await db.setting.findUnique({ where: { key } }))) await setting(key, value);
  };
  await setting("reviews", { enabled: true, source: "site", rating: 0, count: 0, url: "" });
  // lokaal testen zonder Mollie-sleutel: betalingen simuleren; de overige connecties houden hun standaardwaarden
  await settingIfMissing("connections", { mollie: { simulate: true } });
  // postcode staat op de oude contactpagina; de rest van de bedrijfsgegevens komt uit de standaardwaarden (src/lib/settings.ts)
  await settingIfMissing("site", { postalCode: c.company.Adres?.[1]?.replace(/\s+Waspik$/i, "") || "5165 EG" });

  const cat = (p: string) => categories.find((x) => x.path === p)!;
  const link = (id: string, p: string, label?: string) => ({ id, label: label ?? (cat(p).navTitle && !cat(p).parentPath ? cat(p).navTitle : cat(p).name), href: p });
  await setting("menus", {
    nl: {
      // het megamenu met categorieën komt uit de categorieboom; dit zijn de extra links erachter
      main: [
        { id: "m1", label: "Merken", href: "/merken/" },
        { id: "m2", label: "Blog", href: "/blog/" },
        { id: "m3", label: "Klantenservice", key: "klantenservice" },
      ],
      footer: [
        { id: "f1", label: "Populair", key: null, children: [link("f11", "/onderhoud/reinigingsproducten/"), link("f12", "/bootonderdelen/boegschroeven/"), link("f13", "/bootonderdelen/blokken/"), link("f14", "/bootonderdelen/ankers-en-lieren/"), link("f15", "/navigatie-elektronica/", "Navigatie & elektronica"), link("f16", "/watersport/accessoires/"), link("f17", "/pakketten/5-liter-deals/"), link("f18", "/bestsellers/")] },
        { id: "f2", label: "Bootonderdelen", key: null, children: categories.filter((x) => x.parentPath === "/bootonderdelen/").map((x, i) => link(`f2${i + 1}`, x.path)) },
        {
          id: "f3", label: "Informatie", key: null,
          children: [
            { id: "f31", label: "Over ons", key: "over-ons" },
            { id: "f32", label: "Verzending", key: "verzending" },
            { id: "f33", label: "Retourbeleid", key: "retourbeleid" },
            { id: "f34", label: "Privacy", key: "privacy" },
            { id: "f35", label: "Cookies", key: "cookies" },
            { id: "f36", label: "Algemene voorwaarden", key: "terms" },
            { id: "f37", label: "Juridische informatie", key: "legal" },
          ],
        },
        {
          id: "f4", label: "Klantenservice", key: null,
          children: [
            { id: "f41", label: "Klantenservice", key: "klantenservice" },
            { id: "f42", label: "Veelgestelde vragen", key: "faq" },
            { id: "f43", label: "Contact", key: "contact" },
            { id: "f44", label: "Hoe wij bestellingen verwerken", key: "bestellingen" },
          ],
        },
        {
          id: "f5", label: "Mijn account", key: null,
          children: [
            { id: "f51", label: "Mijn bestellingen", href: "/account/bestellingen/" },
            { id: "f52", label: "Mijn gegevens", href: "/account/gegevens/" },
            { id: "f53", label: "Adressen", href: "/account/adressen/" },
            { id: "f54", label: "Winkelwagen", href: "/winkelwagen/" },
          ],
        },
      ],
    },
  });

  const counts = {
    rollen: await db.role.count(), gebruikers: await db.user.count(), klanten: await db.customer.count(), merken: await db.brand.count(), categorieën: await db.category.count(),
    producten: await db.product.count(), "product-categoriekoppelingen": await db.productCategory.count(), reviews: await db.review.count(), "pagina's": await db.page.count(), vragen: await db.faq.count(),
    redirects: await db.redirect.count(), media: await db.media.count(), blogs: await db.post.count(), formulieren: await db.form.count(), kortingscodes: await db.discount.count(), instellingen: await db.setting.count(),
  };
  console.log("Klaar:", Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(", "));
  if (warnings.length) {
    console.log(`\n${warnings.length} opmerkingen:`);
    for (const w of warnings) console.log(" -", w);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
