"use server";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/components/admin/fields";
import { aiMetaDescription } from "@/lib/ai";
import { audit } from "@/lib/admin/audit";
import { bool, isRedirect, localInput, normalizePath, num, opt, pathTaken, redirectOnMove, refresh, reservedPath, statusOf, str } from "@/lib/admin/common";
import { ENTITY_NAMES } from "@/lib/admin/labels";
import { ensureBaseline, restoreRevision, snapshot, EDIT_URL, type Entity } from "@/lib/admin/revisions";
import { cleanHtml } from "@/lib/admin/sanitize";
import { destroy, isTrashType, setDeleted, type TrashType } from "@/lib/admin/trash";
import { assertRole } from "@/lib/auth";
import { parseBlocks, type Block } from "@/lib/blocks";
import { db } from "@/lib/db";
import { plain, slugify } from "@/lib/text";

// Server actions voor pagina's en veelgestelde vragen, plus prullenbak, revisies, bulkacties en snel meta
// aanpassen (ook voor producten, categorieën en blogs). Elke actie controleert de rol op de server, valideert,
// schoont HTML op, maakt een revisie, logt in het logboek en ververst de publieke pagina's.

const fail = (error: string, errors?: Record<string, string>): ActionResult => ({ error, errors });
const json = <T,>(v: string, fallback: T): T => {
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
};
const LABEL = ENTITY_NAMES as Record<TrashType, string>;
const HOME = "/";
const FAQ_PATH = "/veelgestelde-vragen/";

// ---------- AI-hulp ----------
export async function suggestMeta(form: FormData): Promise<{ text?: string; error?: string }> {
  try {
    await assertRole("user");
    const title = str(form, "title") || str(form, "name");
    const content = plain([str(form, "intro"), str(form, "summary"), str(form, "lead"), str(form, "excerpt"), str(form, "description"), str(form, "content")].join(" "));
    if (!title) return { error: "Vul eerst een titel in." };
    return { text: await aiMetaDescription(title, content || title) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "AI-voorstel mislukt" };
  }
}

/** Blokken uit de editor: structuur als JSON, de rich-text van elk blok in een eigen veld (b_<id>_<veld>). */
function readBlocks(form: FormData): Block[] {
  const blocks = parseBlocks(str(form, "blocks"));
  const rich = (b: Block, field: string) => cleanHtml(String(form.get(`b_${b.id}_${field}`) ?? ""));
  return blocks.map((b) => {
    switch (b.type) {
      case "section":
        return { ...b, heading: b.heading.trim(), html: rich(b, "html") };
      case "text":
        return { ...b, html: rich(b, "html") };
      case "faq":
        return { ...b, html: rich(b, "html") };
      case "cta":
        return { ...b, html: rich(b, "html"), label: b.label.trim(), href: b.href.trim() };
      case "form":
        return { ...b, html: rich(b, "html"), note: rich(b, "note") };
      case "cards":
        return {
          ...b,
          items: b.items.map((i) => {
            const { _k, ...rest } = i as typeof i & { _k?: string };
            return { ...rest, title: i.title.trim(), html: cleanHtml(String(form.get(`b_${b.id}_card_${_k}`) ?? i.html)) };
          }),
        };
      default:
        return b;
    }
  });
}

// ---------- pagina's ----------
export async function savePage(id: string | null, _: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const title = str(form, "title");
    if (title.length < 2) return fail("Vul een titel in.", { title: "Verplicht" });
    const old = id ? await db.page.findUnique({ where: { id } }) : null;
    const isHome = old?.path === HOME;
    const path = isHome ? HOME : normalizePath(str(form, "path") || `/${slugify(title)}/`);
    if (!path) return fail("Het URL-pad mag alleen kleine letters, cijfers en koppeltekens bevatten.", { path: "Ongeldig" });
    if (!isHome && !/^\/[a-z0-9-]+\/$/.test(path)) return fail("Een pagina staat altijd op één niveau, bijvoorbeeld /over-ons/.", { path: "Eén niveau" });
    if (reservedPath(path, "page")) return fail("Dit pad is gereserveerd voor een vast onderdeel van de site (bijvoorbeeld producten, blog of winkelwagen).", { path: "Gereserveerd" });
    if (await pathTaken(path, { table: "page", id })) return fail("Dit URL-pad is al in gebruik door een pagina, categorie, product of blog.", { path: "Bestaat al" });
    const translationKey = slugify(str(form, "translationKey")) || old?.translationKey || slugify(title);
    const clash = await db.page.findFirst({ where: { translationKey, deletedAt: null, NOT: id ? { id } : undefined }, select: { path: true } });
    if (clash) return fail(`Er bestaat al een pagina met deze sleutel (${clash.path}).`, { translationKey: "Al in gebruik" });
    if (id) await ensureBaseline("page", id, user);
    const parentKey = isHome ? null : opt(form, "parentKey");
    const data = {
      path,
      locale: "nl",
      translationKey,
      parentKey: parentKey === translationKey ? null : parentKey,
      title,
      navTitle: str(form, "navTitle"),
      intro: plain(str(form, "intro")),
      summary: plain(str(form, "summary")),
      blocks: JSON.stringify(readBlocks(form)),
      heroImage: opt(form, "heroImage"),
      heroAlt: str(form, "heroAlt"),
      section: str(form, "section") || "overig",
      template: str(form, "template") || "default",
      ctaLabel: opt(form, "ctaLabel"),
      status: isHome ? "published" : statusOf(form),
      noindex: bool(form, "noindex"),
      isDraftCopy: bool(form, "isDraftCopy"),
      sortOrder: num(form, "sortOrder") ?? old?.sortOrder ?? 0,
      metaTitle: opt(form, "metaTitle"),
      metaDescription: opt(form, "metaDescription"),
      ogImage: opt(form, "ogImage"),
      publishedAt: old && str(form, "publishedAt") === localInput(old.publishedAt) ? old.publishedAt : str(form, "publishedAt") ? new Date(str(form, "publishedAt")) : new Date(),
    };
    if (data.heroImage && !data.heroAlt) return fail("Geef de afbeelding een alt-tekst: beschrijf wat er te zien is.", { heroAlt: "Verplicht bij een afbeelding" });
    if (id) {
      await db.page.update({ where: { id }, data });
      await redirectOnMove(old?.path, path);
      await snapshot("page", id, user);
      await audit(user, "gewijzigd", "Pagina", id, `${title} bijgewerkt`);
      refresh(path, old?.path);
      return { ok: true, message: "Opgeslagen. De pagina is direct bijgewerkt op de website." };
    }
    const created = await db.page.create({ data });
    await snapshot("page", created.id, user);
    await audit(user, "aangemaakt", "Pagina", created.id, `${title} aangemaakt`);
    refresh(path);
    redirect(`/admin/paginas/${created.id}/bewerken/?nieuw=1`);
  } catch (e) {
    if (isRedirect(e)) throw e;
    return fail(e instanceof Error ? e.message : "Opslaan mislukt");
  }
}

// ---------- veelgestelde vragen ----------
export async function saveFaq(id: string | null, _: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const question = str(form, "question");
    const answer = cleanHtml(str(form, "answer"));
    if (question.length < 5) return fail("Vul een vraag in.", { question: "Verplicht" });
    if (plain(answer).length < 5) return fail("Vul een antwoord in.", { answer: "Verplicht" });
    if (id) await ensureBaseline("faq", id, user);
    const data = { question, answer, locale: "nl", category: str(form, "category") || "Algemeen", status: statusOf(form), sortOrder: num(form, "sortOrder") ?? 0 };
    if (id) {
      await db.faq.update({ where: { id }, data });
      await snapshot("faq", id, user);
      await audit(user, "gewijzigd", "Veelgestelde vraag", id, `${question} bijgewerkt`);
      refresh(FAQ_PATH);
      return { ok: true, message: "Opgeslagen." };
    }
    const max = await db.faq.aggregate({ _max: { sortOrder: true } });
    const created = await db.faq.create({ data: { ...data, sortOrder: num(form, "sortOrder") ?? (max._max.sortOrder ?? 0) + 1 } });
    await snapshot("faq", created.id, user);
    await audit(user, "aangemaakt", "Veelgestelde vraag", created.id, `${question} aangemaakt`);
    refresh(FAQ_PATH);
    redirect(`/admin/faq/${created.id}/bewerken/?nieuw=1`);
  } catch (e) {
    if (isRedirect(e)) throw e;
    return fail(e instanceof Error ? e.message : "Opslaan mislukt");
  }
}

/** Volgorde van de vragen (drag & drop in het overzicht). */
export async function reorderFaqs(ids: string[]): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    await db.$transaction(ids.map((id, i) => db.faq.update({ where: { id }, data: { sortOrder: i } })));
    await audit(user, "gewijzigd", "Veelgestelde vraag", null, `Volgorde van ${ids.length} vragen aangepast`);
    refresh(FAQ_PATH);
    return { ok: true, message: "Volgorde opgeslagen." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Opslaan mislukt");
  }
}

// ---------- prullenbak ----------
const LIST_URL: Record<TrashType, string> = { page: "/admin/paginas/", faq: "/admin/faq/", form: "/admin/formulieren/", product: "/admin/producten/", category: "/admin/categorieen/", post: "/admin/blog/" };

async function isHomePage(type: TrashType, id: string) {
  return type === "page" && (await db.page.findUnique({ where: { id }, select: { path: true } }))?.path === HOME;
}

/** Naar de prullenbak (werkt voor pagina's, vragen, formulieren, producten, categorieën en blogs). */
export async function moveToTrash(type: TrashType, id: string) {
  const user = await assertRole("user");
  if (!isTrashType(type)) throw new Error("Onbekend type.");
  if (await isHomePage(type, id)) throw new Error("De homepage kan niet verwijderd worden.");
  const r = await setDeleted(type, id, true);
  await audit(user, "verwijderd", LABEL[type], id, `${r.title} naar de prullenbak`);
  refresh(r.path);
  redirect(`${LIST_URL[type]}?verwijderd=1`);
}

export async function restoreFromTrash(type: TrashType, id: string) {
  const user = await assertRole("user");
  if (!isTrashType(type)) throw new Error("Onbekend type.");
  const r = await setDeleted(type, id, false);
  await audit(user, "gewijzigd", LABEL[type], id, `${r.title} hersteld uit de prullenbak`);
  refresh(r.path);
  redirect("/admin/prullenbak/?hersteld=1");
}

/** Eén item definitief verwijderen (alleen als het in de prullenbak ligt). */
export async function destroyFromTrash(type: TrashType, id: string) {
  const user = await assertRole("user");
  if (!isTrashType(type)) throw new Error("Onbekend type.");
  if (await isHomePage(type, id)) throw new Error("De homepage kan niet verwijderd worden.");
  const item = await setDeleted(type, id, true); // bevestigt dat het item bestaat; het blijft "verwijderd"
  await destroy(type, id);
  await audit(user, "verwijderd", LABEL[type], id, `${item.title} definitief verwijderd`);
  refresh();
  redirect("/admin/prullenbak/?definitief=1");
}

/** Bulk in de prullenbak: herstellen of definitief verwijderen. */
export async function bulkTrash(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const action = str(form, "bulk");
    const ids = form.getAll("ids").map(String);
    if (!ids.length) return fail("Selecteer eerst items.");
    if (action !== "restore" && action !== "destroy") return fail("Kies een actie.");
    let ok = 0;
    let bad = 0;
    for (const raw of ids) {
      const [type, id] = raw.split(":");
      try {
        if (!isTrashType(type) || !id) throw new Error("onbekend type");
        if (action === "restore") {
          const r = await setDeleted(type, id, false);
          await audit(user, "gewijzigd", LABEL[type], id, `${r.title} hersteld uit de prullenbak`);
        } else {
          if (await isHomePage(type, id)) throw new Error("homepage");
          await destroy(type, id);
          await audit(user, "verwijderd", LABEL[type], id, "definitief verwijderd");
        }
        ok++;
      } catch {
        bad++;
      }
    }
    refresh();
    return { ok: true, message: `${ok} gelukt${bad ? `, ${bad} mislukt` : ""}.` };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Mislukt");
  }
}

// ---------- revisies ----------
export async function restoreRevisionAction(revId: string) {
  const user = await assertRole("user");
  const rev = await restoreRevision(revId, user);
  await audit(user, "gewijzigd", "Revisie", rev.entityId, `${rev.title} teruggezet naar versie van ${rev.createdAt.toISOString()}`);
  refresh();
  redirect(`${EDIT_URL[rev.entity as Entity](rev.entityId)}?teruggezet=1`);
}

// ---------- bulkacties in de overzichten ----------
export async function bulkContent(type: "page" | "faq", _: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const action = str(form, "bulk");
    let ids = form.getAll("ids").map(String);
    // "alle resultaten van het filter": de ids staan als JSON in een verborgen veld
    if (str(form, "scope") === "all") ids = json<string[]>(str(form, "allIds"), ids);
    if (!ids.length) return fail("Selecteer eerst items.");
    let ok = 0;
    let bad = 0;
    for (const id of ids) {
      try {
        if (action === "publish" || action === "draft") {
          const status = action === "publish" ? "published" : "draft";
          if (type === "page") {
            if (status === "draft" && (await isHomePage("page", id))) throw new Error("homepage");
            await db.page.update({ where: { id }, data: { status } });
          } else await db.faq.update({ where: { id }, data: { status } });
          await snapshot(type, id, user);
        } else if (action === "noindex-on" || action === "noindex-off") {
          if (type !== "page") throw new Error("n.v.t.");
          await db.page.update({ where: { id }, data: { noindex: action === "noindex-on" } });
          await snapshot(type, id, user);
        } else if (action === "trash") {
          if (await isHomePage(type, id)) throw new Error("homepage");
          await setDeleted(type, id, true);
        } else throw new Error("onbekende actie");
        ok++;
      } catch {
        bad++;
      }
    }
    await audit(user, action === "trash" ? "verwijderd" : "gewijzigd", LABEL[type], null, `Bulkactie "${action}" op ${ids.length} items (${ok} gelukt, ${bad} mislukt)`);
    refresh();
    return { ok: true, message: `${ok} gelukt${bad ? `, ${bad} mislukt (bijvoorbeeld de homepage)` : ""}.` };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Bulkactie mislukt");
  }
}

// ---------- snel meta aanpassen vanuit de overzichten (pagina, product, categorie, blog) ----------
export type MetaType = "page" | "product" | "category" | "post";

export async function saveMeta(type: MetaType, id: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const data = { metaTitle: opt(form, "metaTitle"), metaDescription: opt(form, "metaDescription") };
    await ensureBaseline(type, id, user);
    let path: string;
    if (type === "page") path = (await db.page.update({ where: { id }, data, select: { path: true } })).path;
    else if (type === "product") path = (await db.product.update({ where: { id }, data, select: { path: true } })).path;
    else if (type === "category") path = (await db.category.update({ where: { id }, data, select: { path: true } })).path;
    else if (type === "post") path = (await db.post.update({ where: { id }, data, select: { path: true } })).path;
    else return fail("Onbekend type.");
    await snapshot(type, id, user);
    await audit(user, "gewijzigd", ENTITY_NAMES[type], id, `Meta-gegevens van ${path} aangepast`);
    refresh(path);
    return { ok: true, message: "Opgeslagen." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Opslaan mislukt");
  }
}
