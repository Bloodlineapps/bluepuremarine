"use server";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import type { ActionResult } from "@/components/admin/fields";
import { decodeCsv, parseCsv } from "@/components/admin/shop/csv";
import { VAT_RATES } from "@/components/admin/shop/format";
import { aiMetaDescription } from "@/lib/ai";
import { audit } from "@/lib/admin/audit";
import { RESERVED_SEGMENTS, bool, isRedirect, localInput, normalizePath, num, opt, pathTaken, redirectOnMove, refresh, statusOf, str } from "@/lib/admin/common";
import { ensureBaseline, snapshot } from "@/lib/admin/revisions";
import { cleanHtml } from "@/lib/admin/sanitize";
import { setDeleted } from "@/lib/admin/trash";
import { assertRole, type AdminUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parse } from "@/lib/json";
import { money, toCents } from "@/lib/money";
import { cancelOrder, completeOrder, markOrderPaid, refundOrder, shipOrder } from "@/lib/orders";
import type { ProductImage, Spec } from "@/lib/shop";
import { plain, slugify } from "@/lib/text";

// Server actions voor het webshopbeheer: producten (incl. varianten en CSV-import), categorieën, merken, bestellingen,
// klanten, kortingscodes, reviews en nieuwsbriefaanmeldingen. Elke actie controleert de rol op de server, valideert,
// schoont HTML op, maakt waar het model dat ondersteunt een revisie, logt in het logboek en ververst de site.

const fail = (error: string, errors?: Record<string, string>): ActionResult => ({ error, errors });
const caught = (e: unknown, fallback = "Opslaan mislukt") => fail(e instanceof Error ? e.message : fallback);

/** Geselecteerde ids uit de bulkbalk (of alle resultaten van het filter). */
function idsOf(form: FormData) {
  const ids = form.getAll("ids").map(String);
  return str(form, "scope") === "all" ? parse<string[]>(str(form, "allIds"), ids) : ids;
}

/** Voert een bulkactie per item uit en telt wat lukt en mislukt. */
async function each(ids: string[], fn: (id: string) => Promise<unknown>) {
  let ok = 0;
  let bad = 0;
  for (const id of ids) {
    try {
      await fn(id);
      ok++;
    } catch {
      bad++;
    }
  }
  return { ok, bad, message: `${ok} gelukt${bad ? `, ${bad} mislukt` : ""}.` };
}

/** Publicatiedatum uit het formulier; ongewijzigd laten als het veld niet is aangepast (seconden blijven dan behouden). */
const publishedOf = (form: FormData, old?: { publishedAt: Date } | null) => {
  const v = str(form, "publishedAt");
  if (old && v === localInput(old.publishedAt)) return old.publishedAt;
  const d = v ? new Date(v) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

// ---------- AI-hulp ----------
/** Meta-description voorstellen op basis van naam/titel en de tekstvelden van het formulier. */
export async function suggestShopMeta(form: FormData): Promise<{ text?: string; error?: string }> {
  try {
    await assertRole("user");
    const title = str(form, "name") || str(form, "title");
    if (!title) return { error: "Vul eerst een naam in." };
    const content = plain([str(form, "subtitle"), str(form, "lead"), str(form, "intro"), str(form, "description"), str(form, "usage")].join(" "));
    return { text: await aiMetaDescription(title, content || title, "nl") };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "AI-voorstel mislukt" };
  }
}

// ---------- producten ----------
type VariantInput = { id?: string; name?: string; options?: string[]; price?: string; compareAtPrice?: string; sku?: string; stock?: string | number };
type VariantData = { id?: string; name: string; options: string; price: number; compareAtPrice: number | null; sku: string | null; stock: number; sortOrder: number };

/** Varianten uit het formulier lezen en valideren. */
function readVariants(form: FormData, keep: number[]): { error?: string; list: VariantData[] } {
  const list: VariantData[] = [];
  for (const [i, v] of parse<VariantInput[]>(str(form, "variants"), []).entries()) {
    const options = keep.map((j) => String(v.options?.[j] ?? "").trim());
    const name = String(v.name ?? "").trim() || options.filter(Boolean).join(" / ");
    if (!name) return { error: `Variant ${i + 1}: vul een naam of optiewaarde in.`, list };
    const price = toCents(String(v.price ?? ""));
    if (price == null || String(v.price ?? "").trim() === "") return { error: `Variant "${name}": vul een geldige prijs in.`, list };
    const cmpRaw = String(v.compareAtPrice ?? "").trim();
    const compareAtPrice = cmpRaw ? toCents(cmpRaw) : null;
    if (cmpRaw && (compareAtPrice == null || compareAtPrice <= price)) return { error: `Variant "${name}": de van-prijs moet hoger zijn dan de prijs.`, list };
    const stock = Math.max(0, Math.round(Number(String(v.stock ?? "0").replace(",", ".")) || 0));
    list.push({ id: v.id || undefined, name, options: JSON.stringify(options), price, compareAtPrice, sku: String(v.sku ?? "").trim() || null, stock, sortOrder: i });
  }
  return { list };
}

/** Koppeling product ↔ categorieën bijwerken; bestaande posities blijven staan, nieuwe komen achteraan. */
async function syncCategories(tx: Prisma.TransactionClient, productId: string, categoryIds: string[]) {
  const existing = await tx.productCategory.findMany({ where: { productId }, select: { categoryId: true } });
  await tx.productCategory.deleteMany({ where: { productId, categoryId: { notIn: categoryIds } } });
  for (const categoryId of categoryIds) {
    if (existing.some((e) => e.categoryId === categoryId)) continue;
    const max = await tx.productCategory.aggregate({ where: { categoryId }, _max: { position: true } });
    await tx.productCategory.create({ data: { productId, categoryId, position: (max._max.position ?? -1) + 1 } });
  }
}

export async function saveProduct(id: string | null, _: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const name = str(form, "name");
    if (name.length < 2) return fail("Vul een productnaam in.", { name: "Verplicht" });
    const old = id ? await db.product.findUnique({ where: { id } }) : null;
    if (id && !old) return fail("Dit product bestaat niet meer.");
    const slug = slugify(str(form, "slug") || name);
    if (!slug) return fail("Vul een geldige slug in (kleine letters, cijfers en koppeltekens).", { slug: "Ongeldig" });
    const path = `/producten/${slug}/`;
    if (await db.product.findFirst({ where: { slug, NOT: id ? { id } : undefined }, select: { id: true } })) return fail("Deze slug is al in gebruik door een ander product (mogelijk in de prullenbak).", { slug: "Bestaat al" });

    // optienamen zonder naam vervallen, samen met de bijbehorende waarde van elke variant
    const rawNames = parse<string[]>(str(form, "optionNames"), []).map((o) => String(o).trim()).slice(0, 3);
    const keep = rawNames.map((n, i) => (n ? i : -1)).filter((i) => i >= 0);
    const optionNames = keep.map((i) => rawNames[i]);
    const variants = readVariants(form, keep);
    if (variants.error) return fail(variants.error);
    const hasVariants = variants.list.length > 0;

    const priceRaw = str(form, "price");
    let price = priceRaw ? toCents(priceRaw) : null;
    if (!hasVariants && price == null) return fail("Vul een geldige prijs in, bijvoorbeeld 24,95.", { price: "Verplicht" });
    const cmpRaw = str(form, "compareAtPrice");
    let compareAtPrice = cmpRaw ? toCents(cmpRaw) : null;
    if (cmpRaw && compareAtPrice == null) return fail("De van-prijs is geen geldig bedrag.", { compareAtPrice: "Ongeldig" });
    let stock = Math.max(0, Math.round(num(form, "stock") ?? 0));
    if (hasVariants) {
      // bij varianten: prijs = laagste variantprijs, voorraad = som van de varianten
      const cheapest = variants.list.reduce((a, b) => (b.price < a.price ? b : a));
      price = cheapest.price;
      compareAtPrice = cheapest.compareAtPrice ?? null;
      stock = variants.list.reduce((s, v) => s + v.stock, 0);
    } else if (compareAtPrice != null && compareAtPrice <= price!) return fail("De van-prijs moet hoger zijn dan de prijs (of laat hem leeg).", { compareAtPrice: "Te laag" });
    const vatRate = num(form, "vatRate") ?? 21;
    if (!VAT_RATES.includes(vatRate)) return fail("Kies 21%, 9% of 0% btw.", { vatRate: "Ongeldig" });

    // afbeeldingen: alt-tekst verplicht; afmetingen aanvullen uit de mediabibliotheek
    const images = parse<ProductImage[]>(str(form, "images"), []).filter((i) => i && typeof i.src === "string" && i.src).map((i) => ({ ...i, alt: String(i.alt ?? "").trim() }));
    if (images.some((i) => !i.alt)) return fail("Geef elke afbeelding een alt-tekst: beschrijf kort wat er te zien is.", { images: "Alt-tekst verplicht" });
    const media = await db.media.findMany({ where: { path: { in: images.filter((i) => !i.width).map((i) => i.src) } }, select: { path: true, width: true, height: true } });
    for (const i of images) {
      const m = media.find((x) => x.path === i.src);
      if (!i.width && m?.width && m.height) Object.assign(i, { width: m.width, height: m.height });
    }
    const specs = parse<Spec[]>(str(form, "specs"), []).map((s) => ({ label: String(s.label ?? "").trim(), value: String(s.value ?? "").trim() })).filter((s) => s.label && s.value);

    const primaryCategoryId = opt(form, "primaryCategoryId");
    const wanted = [...new Set([...(primaryCategoryId ? [primaryCategoryId] : []), ...form.getAll("categoryIds").map(String)])];
    const categoryIds = (await db.category.findMany({ where: { id: { in: wanted } }, select: { id: true } })).map((c) => c.id);
    if (primaryCategoryId && !categoryIds.includes(primaryCategoryId)) return fail("De gekozen hoofdcategorie bestaat niet meer.", { primaryCategoryId: "Ongeldig" });

    const data = {
      slug,
      path,
      name,
      subtitle: str(form, "subtitle"),
      lead: str(form, "lead"),
      description: cleanHtml(str(form, "description")),
      usage: cleanHtml(str(form, "usage")),
      specs: JSON.stringify(specs),
      images: JSON.stringify(images),
      productType: str(form, "productType"),
      brandId: opt(form, "brandId"),
      primaryCategoryId,
      price: price!,
      compareAtPrice,
      vatRate,
      sku: opt(form, "sku"),
      ean: opt(form, "ean"),
      stock,
      trackStock: bool(form, "trackStock"),
      weight: Math.max(0, Math.round(num(form, "weight") ?? 0)),
      deliveryNote: str(form, "deliveryNote"),
      optionNames: JSON.stringify(hasVariants ? optionNames : []),
      featured: bool(form, "featured"),
      status: statusOf(form),
      noindex: bool(form, "noindex"),
      metaTitle: opt(form, "metaTitle"),
      metaDescription: opt(form, "metaDescription"),
      publishedAt: publishedOf(form, old),
    };
    if (id) await ensureBaseline("product", id, user);
    const saved = await db.$transaction(async (tx) => {
      const p = id ? await tx.product.update({ where: { id }, data }) : await tx.product.create({ data });
      await tx.variant.deleteMany({ where: { productId: p.id, id: { notIn: variants.list.map((v) => v.id).filter((x): x is string => !!x) } } });
      for (const { id: vid, ...v } of variants.list) {
        if (vid) await tx.variant.updateMany({ where: { id: vid, productId: p.id }, data: v });
        else await tx.variant.create({ data: { ...v, productId: p.id } });
      }
      await syncCategories(tx, p.id, categoryIds);
      return p;
    });
    await snapshot("product", saved.id, user);
    if (id) {
      await redirectOnMove(old?.path, path);
      await audit(user, "gewijzigd", "Product", id, `${name} bijgewerkt`);
      refresh(path, old?.path);
      return { ok: true, message: `Opgeslagen. Het product is direct bijgewerkt op de website${old?.path !== path ? "; de oude URL verwijst automatisch door (301)" : ""}.` };
    }
    await audit(user, "aangemaakt", "Product", saved.id, `${name} aangemaakt`);
    refresh(path);
    redirect(`/admin/producten/${saved.id}/bewerken/?nieuw=1`);
  } catch (e) {
    if (isRedirect(e)) throw e;
    return caught(e);
  }
}

/** Kopie van een product als concept (met varianten en categorieën), zonder SKU/EAN en verkoopcijfers. */
export async function duplicateProduct(id: string) {
  const user = await assertRole("user");
  const src = await db.product.findUniqueOrThrow({ where: { id }, include: { variants: true, categories: true } });
  let slug = `${src.slug}-kopie`;
  for (let n = 2; await db.product.findUnique({ where: { slug }, select: { id: true } }); n++) slug = `${src.slug}-kopie-${n}`;
  const { id: _id, createdAt: _c, updatedAt: _u, deletedAt: _d, variants, categories, ...rest } = src;
  const copy = await db.product.create({
    data: {
      ...rest,
      slug,
      path: `/producten/${slug}/`,
      name: `${src.name} (kopie)`,
      status: "draft",
      sku: null,
      ean: null,
      sold: 0,
      featured: false,
      sourceHandle: null,
      metaTitle: null,
      metaDescription: null,
      publishedAt: new Date(),
      variants: { create: variants.map(({ id: _v, productId: _p, sku: _s, ...v }) => v) },
      categories: { create: categories.map((c) => ({ categoryId: c.categoryId, position: c.position })) },
    },
  });
  await snapshot("product", copy.id, user, `kopie van ${src.name}`);
  await audit(user, "aangemaakt", "Product", copy.id, `${src.name} gedupliceerd als concept`);
  redirect(`/admin/producten/${copy.id}/bewerken/?kopie=1`);
}

export async function bulkProducts(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const action = str(form, "bulk");
    const ids = idsOf(form);
    if (!ids.length) return fail("Selecteer eerst producten.");
    const res = await each(ids, async (id) => {
      if (action === "publish" || action === "draft") {
        await ensureBaseline("product", id, user);
        await db.product.update({ where: { id }, data: { status: action === "publish" ? "published" : "draft" } });
        await snapshot("product", id, user);
      } else if (action === "featured-on" || action === "featured-off") await db.product.update({ where: { id }, data: { featured: action === "featured-on" } });
      else if (action === "trash") await setDeleted("product", id, true);
      else throw new Error("onbekende actie");
    });
    await audit(user, action === "trash" ? "verwijderd" : "gewijzigd", "Product", null, `Bulkactie "${action}" op ${ids.length} producten (${res.ok} gelukt, ${res.bad} mislukt)`);
    refresh();
    return { ok: true, message: res.message };
  } catch (e) {
    return caught(e, "Bulkactie mislukt");
  }
}

// ---------- producten: CSV-import ----------
export type ImportRow = { line: number; key: string; name: string; action: "create" | "update" | "error"; note: string; done?: boolean };
type Planned = ImportRow & { apply?: () => Promise<void> };
type ImportFields = Partial<{ name: string; sku: string | null; ean: string | null; productType: string; price: number; compareAtPrice: number | null; vatRate: number; stock: number; status: string; weight: number; metaTitle: string | null; metaDescription: string | null; brandId: string | null }>;

/** Leest de CSV en bepaalt per regel wat er gaat gebeuren (aanmaken, bijwerken of een fout), zonder iets te wijzigen. */
async function planImport(csv: string, user: AdminUser): Promise<{ error?: string; rows: Planned[] }> {
  const table = parseCsv(csv);
  if (table.length < 2) return { error: "Het bestand bevat geen productregels.", rows: [] };
  const head = table[0].map((h) => h.trim().toLowerCase());
  if (!head.includes("slug") && !head.includes("sku")) return { error: 'De kolom "slug" of "sku" ontbreekt. Gebruik de export als voorbeeld.', rows: [] };
  if (table.length > 5001) return { error: "Maximaal 5000 regels per import.", rows: [] };
  const [products, brands, cats] = await Promise.all([
    db.product.findMany({ select: { id: true, slug: true, sku: true, name: true, deletedAt: true, _count: { select: { variants: true } } } }),
    db.brand.findMany({ select: { id: true, slug: true, name: true } }),
    db.category.findMany({ where: { deletedAt: null }, select: { id: true, path: true } }),
  ]);
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const bySku = new Map(products.filter((p) => p.sku && !p.deletedAt).map((p) => [p.sku!.toLowerCase(), p]));
  const usedSlugs = new Set(products.map((p) => p.slug));
  const seen = new Set<string>();

  const rows = table.slice(1).map((cells, idx): Planned => {
    const line = idx + 2;
    const get = (k: string) => {
      const i = head.indexOf(k);
      return i < 0 ? undefined : (cells[i] ?? "").trim();
    };
    const slugIn = slugify(get("slug") ?? "");
    const sku = get("sku");
    const found = (slugIn && bySlug.get(slugIn)) || (sku && bySku.get(sku.toLowerCase())) || null;
    const errs: string[] = [];
    const notes: string[] = [];
    const f: ImportFields = {};
    const name = get("naam");
    if (name) f.name = name;
    if (sku !== undefined) f.sku = sku || null;
    if (get("ean") !== undefined) f.ean = get("ean") || null;
    if (get("productsoort") !== undefined) f.productType = get("productsoort")!;
    if (get("prijs")) {
      const c = toCents(get("prijs")!);
      if (c == null) errs.push("ongeldige prijs");
      else f.price = c;
    }
    if (get("van-prijs") !== undefined) {
      const c = get("van-prijs") ? toCents(get("van-prijs")!) : null;
      if (get("van-prijs") && c == null) errs.push("ongeldige van-prijs");
      else f.compareAtPrice = c;
    }
    if (get("btw")) {
      const v = Number(get("btw")!.replace("%", "").trim());
      if (!VAT_RATES.includes(v)) errs.push("btw moet 21, 9 of 0 zijn");
      else f.vatRate = v;
    }
    if (get("voorraad")) {
      const v = Number(get("voorraad"));
      if (!Number.isInteger(v) || v < 0) errs.push("ongeldige voorraad");
      else f.stock = v;
    }
    if (get("status")) {
      const v = get("status")!.toLowerCase();
      if (["published", "gepubliceerd"].includes(v)) f.status = "published";
      else if (["draft", "concept"].includes(v)) f.status = "draft";
      else errs.push('status moet "published" of "draft" zijn');
    }
    if (get("gewicht")) {
      const v = Number(get("gewicht"));
      if (!Number.isInteger(v) || v < 0) errs.push("ongeldig gewicht (in gram)");
      else f.weight = v;
    }
    if (get("meta-title") !== undefined) f.metaTitle = get("meta-title") || null;
    if (get("meta-description") !== undefined) f.metaDescription = get("meta-description") || null;
    let newBrand = "";
    const brandIn = get("merk");
    if (brandIn !== undefined) {
      const b = brandIn ? brands.find((x) => x.name.toLowerCase() === brandIn.toLowerCase() || x.slug === slugify(brandIn)) : null;
      if (!brandIn) f.brandId = null;
      else if (b) f.brandId = b.id;
      else {
        newBrand = brandIn;
        notes.push(`nieuw merk "${brandIn}"`);
      }
    }
    let categoryIds: string[] | null = null;
    if (get("categoriepaden")) {
      categoryIds = [];
      for (const raw of get("categoriepaden")!.split("|").map((s) => s.trim()).filter(Boolean)) {
        const c = cats.find((x) => x.path === normalizePath(raw));
        if (c) categoryIds.push(c.id);
        else errs.push(`onbekende categorie ${raw}`);
      }
      categoryIds = [...new Set(categoryIds)];
    }
    let slug = slugIn;
    if (found?.deletedAt) errs.push("dit product staat in de prullenbak; herstel het eerst");
    if (found && found._count.variants > 0 && (f.price !== undefined || f.stock !== undefined || f.compareAtPrice !== undefined)) {
      delete f.price;
      delete f.stock;
      delete f.compareAtPrice;
      notes.push("heeft varianten: prijs en voorraad niet aangepast");
    }
    if (!found) {
      if (!f.name) errs.push("naam ontbreekt (nodig voor een nieuw product)");
      if (f.price === undefined && !errs.includes("ongeldige prijs")) errs.push("prijs ontbreekt (nodig voor een nieuw product)");
      slug = slugIn || slugify(f.name ?? "");
      if (slug && usedSlugs.has(slug)) errs.push(`de slug "${slug}" bestaat al`);
    }
    if (f.compareAtPrice != null && f.price !== undefined && f.compareAtPrice <= f.price) errs.push("van-prijs moet hoger zijn dan de prijs");
    const key = found?.id ?? slug;
    if (key && seen.has(key)) errs.push("komt vaker voor in dit bestand");
    const base = { line, key: found?.slug ?? slug ?? sku ?? "", name: f.name ?? found?.name ?? "" };
    if (errs.length) return { ...base, action: "error", note: errs.join("; ") };
    seen.add(key);
    if (!found) usedSlugs.add(slug);

    const apply = async () => {
      if (newBrand) f.brandId = (await db.brand.upsert({ where: { slug: slugify(newBrand) }, create: { slug: slugify(newBrand), name: newBrand }, update: {}, select: { id: true } })).id;
      const primary = categoryIds?.length ? { primaryCategoryId: categoryIds[0] } : {};
      if (found) await ensureBaseline("product", found.id, user);
      const pid = await db.$transaction(async (tx) => {
        const p = found ? await tx.product.update({ where: { id: found.id }, data: { ...f, ...primary }, select: { id: true } }) : await tx.product.create({ data: { ...f, ...primary, name: f.name!, price: f.price!, slug, path: `/producten/${slug}/`, status: f.status ?? "draft" }, select: { id: true } });
        if (categoryIds?.length) await syncCategories(tx, p.id, categoryIds);
        return p.id;
      });
      await snapshot("product", pid, user, found ? undefined : "geïmporteerd uit CSV");
    };
    return { ...base, action: found ? "update" : "create", note: notes.join("; ") || (found ? "" : f.status ? "" : "wordt aangemaakt als concept"), apply };
  });
  return { rows };
}

const publicRow = ({ apply: _a, ...r }: Planned): ImportRow => r;

/** Stap 1 van de import: bestand inlezen en tonen wat er aangemaakt of bijgewerkt wordt. */
export async function previewProductImport(form: FormData): Promise<{ error?: string; rows?: ImportRow[]; csv?: string }> {
  try {
    const user = await assertRole("user");
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return { error: "Kies eerst een CSV-bestand." };
    if (file.size > 5_000_000) return { error: "Het bestand is te groot (maximaal 5 MB)." };
    const csv = decodeCsv(await file.arrayBuffer());
    const plan = await planImport(csv, user);
    return plan.error ? { error: plan.error } : { rows: plan.rows.map(publicRow), csv };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Inlezen mislukt" };
  }
}

/** Stap 2: de import uitvoeren. Geeft per regel terug of het gelukt is. */
export async function runProductImport(csv: string): Promise<{ error?: string; message?: string; rows?: ImportRow[] }> {
  try {
    const user = await assertRole("user");
    const plan = await planImport(csv, user);
    if (plan.error) return { error: plan.error };
    const rows: ImportRow[] = [];
    for (const r of plan.rows) {
      if (!r.apply) {
        rows.push({ ...publicRow(r), done: false });
        continue;
      }
      try {
        await r.apply();
        rows.push({ ...publicRow(r), done: true });
      } catch (e) {
        rows.push({ ...publicRow(r), action: "error", done: false, note: e instanceof Error ? e.message.split("\n").pop()!.slice(0, 200) : "mislukt" });
      }
    }
    const ok = rows.filter((r) => r.done).length;
    await audit(user, "geïmporteerd", "Product", null, `CSV-import: ${ok} gelukt, ${rows.length - ok} mislukt`);
    refresh();
    return { message: `${ok} gelukt, ${rows.length - ok} mislukt.`, rows };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Import mislukt" };
  }
}

// ---------- categorieën ----------
export async function saveCategory(id: string | null, _: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const name = str(form, "name");
    if (name.length < 2) return fail("Vul een naam in.", { name: "Verplicht" });
    const old = id ? await db.category.findUnique({ where: { id } }) : null;
    if (id && !old) return fail("Deze categorie bestaat niet meer.");
    const slug = slugify(str(form, "slug") || name);
    if (!slug) return fail("Vul een geldige slug in (kleine letters, cijfers en koppeltekens).", { slug: "Ongeldig" });
    const parentId = opt(form, "parentId");
    const parent = parentId ? await db.category.findUnique({ where: { id: parentId } }) : null;
    if (parentId && (!parent || parent.deletedAt)) return fail("De bovenliggende categorie bestaat niet meer.", { parentId: "Ongeldig" });
    if (parent && (parent.parentId || parent.id === id)) return fail("Categorieën gaan maximaal twee niveaus diep: kies een hoofdcategorie als bovenliggende categorie.", { parentId: "Te diep" });
    if (id && parent && (await db.category.count({ where: { parentId: id, deletedAt: null } }))) return fail("Deze categorie heeft zelf subcategorieën en kan daarom geen subcategorie worden.", { parentId: "Niet mogelijk" });
    if (!parent && RESERVED_SEGMENTS.includes(slug)) return fail(`De slug "${slug}" is gereserveerd voor een vast onderdeel van de website.`, { slug: "Gereserveerd" });
    const path = parent ? `${parent.path}${slug}/` : `/${slug}/`;
    if (path !== old?.path && ((await db.category.findFirst({ where: { path }, select: { id: true } })) || (await pathTaken(path)))) return fail(`De URL ${path} is al in gebruik door een andere pagina, categorie of ander onderdeel.`, { slug: "Bestaat al" });
    const kids = id && old && old.path !== path ? await db.category.findMany({ where: { parentId: id } }) : [];
    for (const k of kids) if (await db.category.findFirst({ where: { path: `${path}${k.slug}/`, NOT: { id: k.id } }, select: { id: true } })) return fail(`De URL ${path}${k.slug}/ van een subcategorie is al in gebruik.`, { slug: "Bestaat al" });
    const image = opt(form, "image");
    const imageAlt = str(form, "imageAlt");
    if (image && !imageAlt) return fail("Geef de afbeelding een alt-tekst: beschrijf wat er te zien is.", { imageAlt: "Verplicht bij een afbeelding" });
    const data = {
      path,
      slug,
      name,
      navTitle: str(form, "navTitle"),
      parentId,
      menuGroup: parent ? str(form, "menuGroup") : "",
      intro: str(form, "intro"),
      description: cleanHtml(str(form, "description")),
      image,
      imageAlt,
      highlight: bool(form, "highlight"),
      status: statusOf(form),
      noindex: bool(form, "noindex"),
      metaTitle: opt(form, "metaTitle"),
      metaDescription: opt(form, "metaDescription"),
    };
    if (id) {
      await ensureBaseline("category", id, user);
      await db.category.update({ where: { id }, data });
      await redirectOnMove(old?.path, path);
      // subcategorieën verhuizen mee met de nieuwe slug van hun hoofdcategorie (elk met een eigen 301)
      for (const k of kids) {
        const moved = `${path}${k.slug}/`;
        await ensureBaseline("category", k.id, user);
        await db.category.update({ where: { id: k.id }, data: { path: moved } });
        await redirectOnMove(k.path, moved);
        await snapshot("category", k.id, user, `URL gewijzigd met de hoofdcategorie (${moved})`);
      }
      await snapshot("category", id, user);
      await audit(user, "gewijzigd", "Categorie", id, `${name} (${path}) bijgewerkt`);
      refresh(path, old?.path);
      return { ok: true, message: `Opgeslagen. De categorie is direct bijgewerkt op de website${old?.path !== path ? `; de oude URL${kids.length ? "'s verwijzen" : " verwijst"} automatisch door (301)` : ""}.` };
    }
    const max = await db.category.aggregate({ where: { parentId }, _max: { sortOrder: true } });
    const created = await db.category.create({ data: { ...data, sortOrder: (max._max.sortOrder ?? -1) + 1 } });
    await snapshot("category", created.id, user);
    await audit(user, "aangemaakt", "Categorie", created.id, `${name} (${path}) aangemaakt`);
    refresh(path);
    redirect(`/admin/categorieen/${created.id}/bewerken/?nieuw=1`);
  } catch (e) {
    if (isRedirect(e)) throw e;
    return caught(e);
  }
}

/** Volgorde van categorieën binnen één niveau (drag & drop in de boom). */
export async function reorderCategories(ids: string[]): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    await db.$transaction(ids.map((id, i) => db.category.update({ where: { id }, data: { sortOrder: i } })));
    await audit(user, "gewijzigd", "Categorie", null, `Volgorde van ${ids.length} categorieën aangepast`);
    refresh();
    return { ok: true, message: "Volgorde opgeslagen." };
  } catch (e) {
    return caught(e);
  }
}

/** Volgorde van de producten binnen een categorie. */
export async function reorderCategoryProducts(categoryId: string, productIds: string[]): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    await db.$transaction(productIds.map((productId, i) => db.productCategory.update({ where: { productId_categoryId: { productId, categoryId } }, data: { position: i } })));
    const cat = await db.category.findUnique({ where: { id: categoryId }, select: { name: true, path: true } });
    await audit(user, "gewijzigd", "Categorie", categoryId, `Productvolgorde in ${cat?.name ?? "categorie"} aangepast`);
    refresh(cat?.path);
    return { ok: true, message: "Volgorde opgeslagen." };
  } catch (e) {
    return caught(e);
  }
}

/** Een categorie mag pas naar de prullenbak als ze geen (zichtbare) subcategorieën meer heeft. */
async function trashCategoryById(id: string) {
  if (await db.category.count({ where: { parentId: id, deletedAt: null } })) throw new Error("Deze categorie heeft nog subcategorieën. Verplaats of verwijder die eerst.");
  return setDeleted("category", id, true);
}

export async function trashCategory(id: string) {
  const user = await assertRole("user");
  const c = await db.category.findUniqueOrThrow({ where: { id }, select: { name: true, path: true } });
  await trashCategoryById(id);
  await audit(user, "verwijderd", "Categorie", id, `${c.name} (${c.path}) naar de prullenbak`);
  refresh(c.path);
  redirect("/admin/categorieen/?verwijderd=1");
}

export async function bulkCategories(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const action = str(form, "bulk");
    const ids = idsOf(form);
    if (!ids.length) return fail("Selecteer eerst categorieën.");
    const res = await each(ids, async (id) => {
      if (action === "publish" || action === "draft") {
        await ensureBaseline("category", id, user);
        await db.category.update({ where: { id }, data: { status: action === "publish" ? "published" : "draft" } });
        await snapshot("category", id, user);
      } else if (action === "trash") await trashCategoryById(id);
      else throw new Error("onbekende actie");
    });
    await audit(user, action === "trash" ? "verwijderd" : "gewijzigd", "Categorie", null, `Bulkactie "${action}" op ${ids.length} categorieën (${res.ok} gelukt, ${res.bad} mislukt)`);
    refresh();
    return { ok: true, message: `${res.message}${res.bad && action === "trash" ? " Een categorie met subcategorieën kan niet naar de prullenbak." : ""}` };
  } catch (e) {
    return caught(e, "Bulkactie mislukt");
  }
}

// ---------- merken ----------
export async function saveBrand(id: string | null, _: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const name = str(form, "name");
    if (name.length < 2) return fail("Vul een merknaam in.", { name: "Verplicht" });
    const old = id ? await db.brand.findUnique({ where: { id } }) : null;
    if (id && !old) return fail("Dit merk bestaat niet meer.");
    const slug = slugify(str(form, "slug") || name);
    if (!slug) return fail("Vul een geldige slug in.", { slug: "Ongeldig" });
    if (await db.brand.findFirst({ where: { slug, NOT: id ? { id } : undefined }, select: { id: true } })) return fail("Deze slug is al in gebruik door een ander merk.", { slug: "Bestaat al" });
    const data = { name, slug, logo: opt(form, "logo"), description: str(form, "description"), metaTitle: opt(form, "metaTitle"), metaDescription: opt(form, "metaDescription") };
    const path = `/merken/${slug}/`;
    if (id) {
      await db.brand.update({ where: { id }, data: { ...data, sortOrder: Math.round(num(form, "sortOrder") ?? old!.sortOrder) } });
      await redirectOnMove(`/merken/${old!.slug}/`, path);
      await audit(user, "gewijzigd", "Merk", id, `${name} bijgewerkt`);
      refresh(path, "/merken/");
      return { ok: true, message: "Opgeslagen." };
    }
    const max = await db.brand.aggregate({ _max: { sortOrder: true } });
    const created = await db.brand.create({ data: { ...data, sortOrder: Math.round(num(form, "sortOrder") ?? (max._max.sortOrder ?? -1) + 1) } });
    await audit(user, "aangemaakt", "Merk", created.id, `${name} aangemaakt`);
    refresh(path, "/merken/");
    redirect(`/admin/merken/${created.id}/bewerken/?nieuw=1`);
  } catch (e) {
    if (isRedirect(e)) throw e;
    return caught(e);
  }
}

export async function reorderBrands(ids: string[]): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    await db.$transaction(ids.map((id, i) => db.brand.update({ where: { id }, data: { sortOrder: i } })));
    await audit(user, "gewijzigd", "Merk", null, `Volgorde van ${ids.length} merken aangepast`);
    refresh("/merken/");
    return { ok: true, message: "Volgorde opgeslagen." };
  } catch (e) {
    return caught(e);
  }
}

/** Merk definitief verwijderen; de producten blijven bestaan, zonder merk. */
export async function deleteBrand(id: string) {
  const user = await assertRole("user");
  const b = await db.brand.delete({ where: { id } });
  await audit(user, "verwijderd", "Merk", id, `${b.name} verwijderd`);
  refresh("/merken/");
  redirect("/admin/merken/?verwijderd=1");
}

export async function bulkBrands(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const ids = idsOf(form);
    if (!ids.length) return fail("Selecteer eerst merken.");
    if (str(form, "bulk") !== "delete") return fail("Kies een bulkactie.");
    const res = await each(ids, (id) => db.brand.delete({ where: { id } }));
    await audit(user, "verwijderd", "Merk", null, `${res.ok} merken verwijderd${res.bad ? `, ${res.bad} mislukt` : ""}`);
    refresh("/merken/");
    return { ok: true, message: res.message };
  } catch (e) {
    return caught(e, "Bulkactie mislukt");
  }
}

// ---------- bestellingen ----------
/** Acties op één bestelling; het eigenlijke werk (status, voorraad, e-mail, Mollie) doet @/lib/orders. */
export async function orderAction(id: string, kind: "paid" | "ship" | "complete" | "cancel" | "refund", _: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const order = await db.order.findUnique({ where: { id }, select: { number: true, total: true, refundedAmount: true } });
    if (!order) return fail("Deze bestelling bestaat niet meer.");
    let res: { ok: boolean; message: string };
    let summary: string;
    if (kind === "paid") {
      res = await markOrderPaid(id);
      summary = "handmatig gemarkeerd als betaald";
    } else if (kind === "ship") {
      const trackingCode = str(form, "trackingCode");
      const trackingUrl = str(form, "trackingUrl");
      if (trackingUrl && !/^https?:\/\/\S+$/i.test(trackingUrl)) return fail("De track & trace-link moet beginnen met https://");
      res = await shipOrder(id, { trackingCode: trackingCode || undefined, trackingUrl: trackingUrl || undefined });
      summary = `verzonden${trackingCode ? ` (track & trace ${trackingCode})` : ""}`;
    } else if (kind === "complete") {
      res = await completeOrder(id);
      summary = "afgerond";
    } else if (kind === "cancel") {
      const reason = str(form, "reason");
      res = await cancelOrder(id, reason || undefined);
      summary = `geannuleerd${reason ? `: ${reason}` : ""}`;
    } else {
      const amount = toCents(str(form, "amount"));
      const open = order.total - order.refundedAmount;
      if (!amount) return fail("Vul het bedrag in dat je wilt terugbetalen, bijvoorbeeld 24,95.");
      if (amount > open) return fail(`Je kunt maximaal ${money(open)} terugbetalen.`);
      res = await refundOrder(id, amount);
      summary = `${money(amount)} terugbetaald`;
    }
    if (!res.ok) return fail(res.message);
    await audit(user, "gewijzigd", "Bestelling", id, `${order.number} ${summary}`);
    refresh();
    return { ok: true, message: res.message };
  } catch (e) {
    return caught(e, "Actie mislukt");
  }
}

export async function saveOrderNote(id: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const o = await db.order.update({ where: { id }, data: { adminNote: str(form, "adminNote").slice(0, 5000) }, select: { number: true } });
    await audit(user, "gewijzigd", "Bestelling", id, `Interne notitie bij ${o.number} aangepast`);
    return { ok: true, message: "Notitie opgeslagen." };
  } catch (e) {
    return caught(e);
  }
}

export async function bulkOrders(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const ids = idsOf(form);
    if (!ids.length) return fail("Selecteer eerst bestellingen.");
    if (str(form, "bulk") !== "complete") return fail("Kies een bulkactie.");
    const res = await each(ids, async (id) => {
      const r = await completeOrder(id);
      if (!r.ok) throw new Error(r.message);
    });
    await audit(user, "gewijzigd", "Bestelling", null, `${res.ok} bestellingen afgerond${res.bad ? `, ${res.bad} mislukt` : ""}`);
    refresh();
    return { ok: true, message: `${res.message}${res.bad ? " Alleen betaalde of verzonden bestellingen kunnen worden afgerond." : ""}` };
  } catch (e) {
    return caught(e, "Bulkactie mislukt");
  }
}

// ---------- klanten ----------
export async function saveCustomer(id: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const firstName = str(form, "firstName");
    const lastName = str(form, "lastName");
    const email = str(form, "email").toLowerCase();
    if (!firstName || !lastName) return fail("Vul een voor- en achternaam in.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Vul een geldig e-mailadres in.", { email: "Ongeldig" });
    if (await db.customer.findFirst({ where: { email, NOT: { id } }, select: { id: true } })) return fail("Er bestaat al een klant met dit e-mailadres.", { email: "Bestaat al" });
    await db.customer.update({ where: { id }, data: { firstName, lastName, email, phone: str(form, "phone"), newsletter: bool(form, "newsletter") } });
    await audit(user, "gewijzigd", "Klant", id, `${firstName} ${lastName} bijgewerkt`);
    return { ok: true, message: "Opgeslagen." };
  } catch (e) {
    return caught(e);
  }
}

/** Klantaccount verwijderen; bestellingen blijven bewaard (zonder koppeling met het account). */
export async function deleteCustomer(id: string) {
  const user = await assertRole("user");
  const c = await db.customer.delete({ where: { id }, select: { firstName: true, lastName: true } });
  await audit(user, "verwijderd", "Klant", id, `Klantaccount van ${c.firstName} ${c.lastName} verwijderd`);
  redirect("/admin/klanten/?verwijderd=1");
}

export async function bulkCustomers(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const ids = idsOf(form);
    if (!ids.length) return fail("Selecteer eerst klanten.");
    if (str(form, "bulk") !== "delete") return fail("Kies een bulkactie.");
    const res = await each(ids, (id) => db.customer.delete({ where: { id }, select: { id: true } }));
    await audit(user, "verwijderd", "Klant", null, `${res.ok} klantaccounts verwijderd${res.bad ? `, ${res.bad} mislukt` : ""}`);
    refresh();
    return { ok: true, message: res.message };
  } catch (e) {
    return caught(e, "Bulkactie mislukt");
  }
}

// ---------- kortingscodes ----------
export async function saveDiscount(id: string | null, _: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const code = str(form, "code").toUpperCase().replace(/\s+/g, "");
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return fail("De code bestaat uit 3 tot 30 hoofdletters, cijfers of koppeltekens, bijvoorbeeld ZOMER10.", { code: "Ongeldig" });
    if (await db.discount.findFirst({ where: { code, NOT: id ? { id } : undefined }, select: { id: true } })) return fail("Deze code bestaat al.", { code: "Bestaat al" });
    const type = ["percent", "fixed", "shipping"].includes(str(form, "type")) ? str(form, "type") : "percent";
    let value = 0;
    if (type === "percent") {
      value = Math.round(num(form, "value") ?? 0);
      if (value < 1 || value > 100) return fail("Vul een percentage tussen 1 en 100 in.", { value: "Ongeldig" });
    } else if (type === "fixed") {
      value = toCents(str(form, "value")) ?? 0;
      if (value < 1) return fail("Vul het kortingsbedrag in euro's in, bijvoorbeeld 5,00.", { value: "Ongeldig" });
    }
    const minOrder = str(form, "minOrder") ? toCents(str(form, "minOrder")) : 0;
    if (minOrder == null) return fail("Het minimale orderbedrag is geen geldig bedrag.", { minOrder: "Ongeldig" });
    const limit = num(form, "usageLimit");
    if (limit != null && (!Number.isInteger(limit) || limit < 1)) return fail("De limiet is een heel getal van 1 of hoger (leeg = onbeperkt).", { usageLimit: "Ongeldig" });
    const date = (k: string) => (str(form, k) && !Number.isNaN(new Date(str(form, k)).getTime()) ? new Date(str(form, k)) : null);
    const startsAt = date("startsAt");
    const endsAt = date("endsAt");
    if (startsAt && endsAt && endsAt <= startsAt) return fail("De einddatum moet na de startdatum liggen.", { endsAt: "Ongeldig" });
    const data = { code, type, value, minOrder, usageLimit: limit, startsAt, endsAt, active: bool(form, "active") };
    if (id) {
      await db.discount.update({ where: { id }, data });
      await audit(user, "gewijzigd", "Kortingscode", id, `${code} bijgewerkt`);
      return { ok: true, message: "Opgeslagen." };
    }
    const created = await db.discount.create({ data });
    await audit(user, "aangemaakt", "Kortingscode", created.id, `${code} aangemaakt`);
    redirect(`/admin/kortingscodes/${created.id}/bewerken/?nieuw=1`);
  } catch (e) {
    if (isRedirect(e)) throw e;
    return caught(e);
  }
}

export async function deleteDiscount(id: string) {
  const user = await assertRole("user");
  const d = await db.discount.delete({ where: { id } });
  await audit(user, "verwijderd", "Kortingscode", id, `${d.code} verwijderd`);
  redirect("/admin/kortingscodes/?verwijderd=1");
}

export async function bulkDiscounts(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const action = str(form, "bulk");
    const ids = idsOf(form);
    if (!ids.length) return fail("Selecteer eerst kortingscodes.");
    const res = await each(ids, async (id) => {
      if (action === "activate" || action === "deactivate") await db.discount.update({ where: { id }, data: { active: action === "activate" } });
      else if (action === "delete") await db.discount.delete({ where: { id } });
      else throw new Error("onbekende actie");
    });
    await audit(user, action === "delete" ? "verwijderd" : "gewijzigd", "Kortingscode", null, `Bulkactie "${action}" op ${ids.length} kortingscodes (${res.ok} gelukt, ${res.bad} mislukt)`);
    return { ok: true, message: res.message };
  } catch (e) {
    return caught(e, "Bulkactie mislukt");
  }
}

// ---------- reviews ----------
const REVIEW_STATES = ["pending", "approved", "rejected"];

export async function saveReview(id: string | null, _: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const name = str(form, "name");
    const text = str(form, "text");
    const rating = Math.round(num(form, "rating") ?? 0);
    if (!name) return fail("Vul de naam van de reviewer in.", { name: "Verplicht" });
    if (rating < 1 || rating > 5) return fail("Kies een score van 1 tot en met 5 sterren.", { rating: "Verplicht" });
    if (text.length < 3) return fail("Vul de tekst van de review in.", { text: "Verplicht" });
    const dateRaw = str(form, "date");
    const date = dateRaw && !Number.isNaN(new Date(`${dateRaw}T12:00:00`).getTime()) ? new Date(`${dateRaw}T12:00:00`) : new Date();
    const data = { name, rating, title: str(form, "title"), text, date, productId: opt(form, "productId"), verified: bool(form, "verified"), email: opt(form, "email"), status: REVIEW_STATES.includes(str(form, "status")) ? str(form, "status") : "pending" };
    if (id) {
      await db.review.update({ where: { id }, data });
      await audit(user, "gewijzigd", "Review", id, `Review van ${name} bijgewerkt`);
      refresh();
      return { ok: true, message: "Opgeslagen." };
    }
    const created = await db.review.create({ data: { ...data, source: "beheer" } });
    await audit(user, "aangemaakt", "Review", created.id, `Review van ${name} toegevoegd`);
    refresh();
    redirect(`/admin/reviews/${created.id}/bewerken/?nieuw=1`);
  } catch (e) {
    if (isRedirect(e)) throw e;
    return caught(e);
  }
}

/** Goedkeuren of afwijzen vanuit het overzicht; de site en het cijfer in de header gaan direct mee. */
export async function setReviewStatus(id: string, status: "approved" | "rejected" | "pending") {
  const user = await assertRole("user");
  const r = await db.review.update({ where: { id }, data: { status } });
  await audit(user, "gewijzigd", "Review", id, `Review van ${r.name} ${status === "approved" ? "goedgekeurd" : status === "rejected" ? "afgewezen" : "teruggezet naar wachtend"}`);
  refresh();
}

export async function deleteReview(id: string, back: boolean) {
  const user = await assertRole("user");
  const r = await db.review.delete({ where: { id } });
  await audit(user, "verwijderd", "Review", id, `Review van ${r.name} verwijderd`);
  refresh();
  if (back) redirect("/admin/reviews/?verwijderd=1");
}

export async function bulkReviews(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const action = str(form, "bulk");
    const ids = idsOf(form);
    if (!ids.length) return fail("Selecteer eerst reviews.");
    const res = await each(ids, async (id) => {
      if (action === "approve" || action === "reject") await db.review.update({ where: { id }, data: { status: action === "approve" ? "approved" : "rejected" } });
      else if (action === "delete") await db.review.delete({ where: { id } });
      else throw new Error("onbekende actie");
    });
    await audit(user, action === "delete" ? "verwijderd" : "gewijzigd", "Review", null, `Bulkactie "${action}" op ${ids.length} reviews (${res.ok} gelukt, ${res.bad} mislukt)`);
    refresh();
    return { ok: true, message: res.message };
  } catch (e) {
    return caught(e, "Bulkactie mislukt");
  }
}

// ---------- nieuwsbrief ----------
export async function addSubscriber(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const email = str(form, "email").toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Vul een geldig e-mailadres in.");
    if (await db.subscriber.findUnique({ where: { email }, select: { id: true } })) return fail("Dit e-mailadres staat al op de lijst.");
    await db.subscriber.create({ data: { email, source: "beheer" } });
    await audit(user, "aangemaakt", "Nieuwsbrief", null, `${email} toegevoegd`);
    refresh();
    return { ok: true, message: `${email} is toegevoegd.` };
  } catch (e) {
    return caught(e);
  }
}

export async function bulkSubscribers(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const ids = idsOf(form);
    if (!ids.length) return fail("Selecteer eerst aanmeldingen.");
    if (str(form, "bulk") !== "delete") return fail("Kies een bulkactie.");
    const res = await each(ids, (id) => db.subscriber.delete({ where: { id } }));
    await audit(user, "verwijderd", "Nieuwsbrief", null, `${res.ok} aanmeldingen verwijderd${res.bad ? `, ${res.bad} mislukt` : ""}`);
    refresh();
    return { ok: true, message: res.message };
  } catch (e) {
    return caught(e, "Bulkactie mislukt");
  }
}
