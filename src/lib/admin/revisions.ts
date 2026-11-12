import "server-only";
import type { AdminUser } from "../auth";
import { db } from "../db";
import { redirectOnMove } from "./common";
import { ENTITY_NAMES } from "./labels";

// Revisiegeschiedenis: na elke wijziging een volledige momentopname (JSON) van het item, met wie/wanneer en
// welke velden veranderd zijn. Terugzetten = de momentopname terugschrijven (dat wordt zelf ook een revisie).
// Bij een product horen de varianten en de categorie-koppelingen bij de momentopname.

export type Entity = "page" | "faq" | "form" | "product" | "category" | "post";

export const ENTITY_LABEL = ENTITY_NAMES as Record<Entity, string>;
export const isEntity = (v: string): v is Entity => v in ENTITY_LABEL;
export const EDIT_URL: Record<Entity, (id: string) => string> = {
  page: (id) => `/admin/paginas/${id}/bewerken/`,
  faq: (id) => `/admin/faq/${id}/bewerken/`,
  form: (id) => `/admin/formulieren/${id}/bewerken/`,
  product: (id) => `/admin/producten/${id}/bewerken/`,
  category: (id) => `/admin/categorieen/${id}/bewerken/`,
  post: (id) => `/admin/blog/${id}/bewerken/`,
};

/** Velden die we niet vergelijken of terugzetten (techniek, relaties, tijdstempels en tellers). */
const SKIP = new Set(["id", "createdAt", "updatedAt", "deletedAt", "wpId", "sold"]);

export const FIELD_LABEL: Record<string, string> = {
  title: "Titel",
  name: "Naam",
  path: "URL",
  intro: "Inleiding",
  html: "Tekst",
  faqs: "Veelgestelde vragen",
  status: "Status",
  noindex: "Noindex",
  metaTitle: "Meta-title",
  metaDescription: "Meta-description",
  heroImage: "Afbeelding",
  blocks: "Blokken",
  navTitle: "Korte titel",
  summary: "Samenvatting",
  locale: "Taal",
  translationKey: "Sleutel",
  parentKey: "Bovenliggende pagina",
  question: "Vraag",
  answer: "Antwoord",
  category: "Categorie",
  steps: "Velden en stappen",
  template: "Type",
  ctaLabel: "Knoptekst",
  publishedAt: "Publicatiedatum",
  section: "Onderdeel",
  slug: "Slug",
  heroAlt: "Alt-tekst afbeelding",
  sortOrder: "Volgorde",
  ogImage: "Deelafbeelding",
  isDraftCopy: "Concepttekst",
  // formulieren
  key: "Sleutel",
  description: "Omschrijving",
  submitLabel: "Knoptekst",
  notifyEmails: "Meldadressen",
  notifySubject: "Onderwerp melding",
  afterSubmit: "Na versturen",
  successMessage: "Bedanktekst",
  redirectPath: "Doorsturen naar",
  confirmEnabled: "Bevestigingsmail",
  confirmSubject: "Onderwerp bevestiging",
  confirmText: "Tekst bevestiging",
  webhookUrl: "Webhook",
  // producten
  subtitle: "Ondertitel",
  lead: "Inleiding",
  usage: "Gebruik en onderhoud",
  specs: "Specificaties",
  images: "Afbeeldingen",
  productType: "Productsoort",
  brandId: "Merk",
  primaryCategoryId: "Hoofdcategorie",
  categories: "Categorieën",
  price: "Prijs",
  compareAtPrice: "Van-prijs",
  vatRate: "Btw-percentage",
  sku: "Artikelnummer",
  ean: "EAN",
  stock: "Voorraad",
  trackStock: "Voorraad bijhouden",
  weight: "Gewicht",
  deliveryNote: "Levertijd",
  optionNames: "Variantopties",
  variants: "Varianten",
  featured: "Uitgelicht",
  sourceHandle: "Oude Shopify-handle",
  // categorieën
  parentId: "Bovenliggende categorie",
  menuGroup: "Groep in het menu",
  image: "Afbeelding",
  imageAlt: "Alt-tekst afbeelding",
  highlight: "Accent in het menu",
  // blog
  excerpt: "Samenvatting",
  content: "Artikeltekst",
  categoryId: "Categorie",
  tags: "Tags",
  authorName: "Auteur",
};

async function load(entity: Entity, id: string): Promise<Record<string, unknown> | null> {
  switch (entity) {
    case "page":
      return db.page.findUnique({ where: { id } });
    case "faq":
      return db.faq.findUnique({ where: { id } });
    case "form":
      return db.form.findUnique({ where: { id } });
    case "category":
      return db.category.findUnique({ where: { id } });
    case "post":
      return db.post.findUnique({ where: { id } });
    case "product": {
      const p = await db.product.findUnique({ where: { id }, include: { variants: { orderBy: { sortOrder: "asc" } }, categories: { orderBy: { position: "asc" }, select: { categoryId: true, position: true } } } });
      if (!p) return null;
      return { ...p, variants: p.variants.map(({ productId: _p, ...v }) => v) };
    }
  }
}

const clean = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([k]) => !SKIP.has(k)));

/** Vergelijken zonder ruis: witruimte en <br />-varianten in HTML tellen niet, datums op de minuut. */
function norm(v: unknown) {
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return v.slice(0, 16);
    return v.replace(/<br\s*\/?>/g, "<br>").replace(/>\s+</g, "><").replace(/\s+/g, " ").trim();
  }
  if (v instanceof Date) return v.toISOString().slice(0, 16);
  return JSON.stringify(v ?? null);
}

export function diffKeys(a: Record<string, unknown> | null, b: Record<string, unknown>) {
  if (!a) return [];
  return Object.keys(b).filter((k) => !SKIP.has(k) && norm(a[k]) !== norm(b[k]));
}

/** Momentopname na een wijziging opslaan. */
export async function snapshot(entity: Entity, id: string, user: AdminUser, note?: string) {
  const row = await load(entity, id);
  if (!row) return;
  const data = clean(row);
  const prev = await db.revision.findFirst({ where: { entity, entityId: id }, orderBy: { createdAt: "desc" } });
  const changed = diffKeys(prev ? (JSON.parse(prev.data) as Record<string, unknown>) : null, data);
  if (prev && !changed.length && !note) return;
  await db.revision.create({
    data: {
      entity,
      entityId: id,
      title: String(row.title ?? row.name ?? row.question ?? id),
      data: JSON.stringify(data),
      changes: note ?? (prev ? changed.map((k) => FIELD_LABEL[k] ?? k).join(", ") : "eerste versie"),
      userId: user.id,
      userName: user.name,
    },
  });
}

/** Zorgt dat er een "beginversie" bestaat vóór de eerste wijziging (zodat je altijd terug kunt). */
export async function ensureBaseline(entity: Entity, id: string, user: AdminUser) {
  const count = await db.revision.count({ where: { entity, entityId: id } });
  if (!count) await snapshot(entity, id, user, "versie vóór de eerste wijziging in het beheer");
}

type Snap = Record<string, unknown>;
type VariantSnap = { id?: string; name: string; options?: string; price: number; compareAtPrice?: number | null; sku?: string | null; stock?: number; image?: string | null; sortOrder?: number };

/**
 * Product terugzetten: velden, varianten en categorie-koppelingen. De voorraad wordt NIET teruggezet (die verandert
 * door bestellingen): het product en bestaande varianten houden hun huidige voorraad. Verwijzingen naar een merk of
 * categorie die niet meer bestaat vervallen.
 */
async function restoreProduct(id: string, data: Snap) {
  const { variants, categories, stock: _stock, ...fields } = data;
  void _stock;
  await db.$transaction(async (tx) => {
    if (fields.brandId && !(await tx.brand.findUnique({ where: { id: String(fields.brandId) }, select: { id: true } }))) fields.brandId = null;
    if (fields.primaryCategoryId && !(await tx.category.findUnique({ where: { id: String(fields.primaryCategoryId) }, select: { id: true } }))) fields.primaryCategoryId = null;
    await tx.product.update({ where: { id }, data: fields as never });
    if (Array.isArray(categories)) {
      const wanted = categories as { categoryId: string; position?: number }[];
      const existing = new Set((await tx.category.findMany({ where: { id: { in: wanted.map((c) => c.categoryId) } }, select: { id: true } })).map((c) => c.id));
      await tx.productCategory.deleteMany({ where: { productId: id } });
      for (const c of wanted) if (existing.has(c.categoryId)) await tx.productCategory.create({ data: { productId: id, categoryId: c.categoryId, position: c.position ?? 0 } });
    }
    if (Array.isArray(variants)) {
      const current = new Map((await tx.variant.findMany({ where: { productId: id } })).map((v) => [v.id, v.stock]));
      await tx.variant.deleteMany({ where: { productId: id } });
      const list = variants as VariantSnap[];
      for (const v of list) {
        await tx.variant.create({
          data: { ...(v.id ? { id: v.id } : {}), productId: id, name: v.name, options: v.options ?? "[]", price: v.price, compareAtPrice: v.compareAtPrice ?? null, sku: v.sku ?? null, stock: (v.id ? current.get(v.id) : undefined) ?? v.stock ?? 0, image: v.image ?? null, sortOrder: v.sortOrder ?? 0 },
        });
      }
      // bij varianten is de productvoorraad de som van de varianten
      if (list.length) {
        const sum = await tx.variant.aggregate({ where: { productId: id }, _sum: { stock: true } });
        await tx.product.update({ where: { id }, data: { stock: sum._sum.stock ?? 0 } });
      }
    }
  });
}

/** Een eerdere versie terugzetten. */
export async function restoreRevision(revId: string, user: AdminUser) {
  const rev = await db.revision.findUnique({ where: { id: revId } });
  if (!rev) throw new Error("Revisie niet gevonden.");
  const data = JSON.parse(rev.data) as Snap;
  delete data.publishedAt;
  const id = rev.entityId;
  const before = await load(rev.entity as Entity, id);
  try {
    switch (rev.entity as Entity) {
      case "page":
        await db.page.update({ where: { id }, data: data as never });
        break;
      case "faq":
        await db.faq.update({ where: { id }, data: data as never });
        break;
      case "form":
        await db.form.update({ where: { id }, data: data as never });
        break;
      case "category":
        if (data.parentId && (data.parentId === id || !(await db.category.findUnique({ where: { id: String(data.parentId) }, select: { id: true } })))) data.parentId = null;
        await db.category.update({ where: { id }, data: data as never });
        break;
      case "post":
        if (data.categoryId && !(await db.blogCategory.findUnique({ where: { id: String(data.categoryId) }, select: { id: true } }))) data.categoryId = null;
        await db.post.update({ where: { id }, data: data as never });
        break;
      case "product":
        await restoreProduct(id, data);
        break;
      default:
        throw new Error("Onbekend type revisie.");
    }
  } catch (e) {
    if (e instanceof Error && /Unique constraint/.test(e.message)) throw new Error("Terugzetten lukt niet: de URL, slug of sleutel van die versie is inmiddels in gebruik door een ander item.");
    throw e;
  }
  // Verandert de URL door het terugzetten? Dan de redirects bijwerken, net als bij opslaan: anders blijft de
  // redirect van de teruggezette URL naar de vorige URL staan en verwijst de pagina naar een 404.
  if (typeof before?.path === "string" && typeof data.path === "string") await redirectOnMove(before.path, data.path);
  await snapshot(rev.entity as Entity, id, user, `teruggezet naar de versie van ${rev.createdAt.toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam" })}`);
  return rev;
}
