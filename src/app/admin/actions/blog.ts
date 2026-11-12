"use server";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/components/admin/fields";
import { aiMetaDescription } from "@/lib/ai";
import { audit } from "@/lib/admin/audit";
import { bool, isRedirect, localInput, opt, redirectOnMove, refresh, str } from "@/lib/admin/common";
import { ensureBaseline, snapshot } from "@/lib/admin/revisions";
import { cleanHtml } from "@/lib/admin/sanitize";
import { setDeleted } from "@/lib/admin/trash";
import { assertRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { parse } from "@/lib/json";
import { plain, slugify } from "@/lib/text";

// Server actions voor het blog: artikelen (met revisies en prullenbak) en blogcategorieën.
// Gepland publiceren: een artikel met een publicatiedatum in de toekomst wordt als "published" opgeslagen; de site
// toont alleen artikelen met publishedAt <= nu, dus het artikel verschijnt vanzelf op het gekozen moment.

const fail = (error: string, errors?: Record<string, string>): ActionResult => ({ error, errors });
const caught = (e: unknown, fallback = "Opslaan mislukt") => fail(e instanceof Error ? e.message : fallback);

export async function suggestPostMeta(form: FormData): Promise<{ text?: string; error?: string }> {
  try {
    await assertRole("user");
    const title = str(form, "title");
    if (!title) return { error: "Vul eerst een titel in." };
    return { text: await aiMetaDescription(title, plain([str(form, "excerpt"), str(form, "content")].join(" ")) || title, "nl") };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "AI-voorstel mislukt" };
  }
}

/** Bestaande blogcategorie op naam of slug, of een nieuwe aanmaken. */
async function categoryByName(name: string) {
  const slug = slugify(name);
  if (!slug) return null;
  return (await db.blogCategory.upsert({ where: { slug }, create: { slug, name }, update: {}, select: { id: true } })).id;
}

export async function savePost(id: string | null, _: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const title = str(form, "title");
    if (title.length < 2) return fail("Vul een titel in.", { title: "Verplicht" });
    const old = id ? await db.post.findUnique({ where: { id } }) : null;
    if (id && !old) return fail("Dit artikel bestaat niet meer.");
    const slug = slugify(str(form, "slug") || title);
    if (!slug) return fail("Vul een geldige slug in (kleine letters, cijfers en koppeltekens).", { slug: "Ongeldig" });
    const path = `/blog/${slug}/`;
    if (await db.post.findFirst({ where: { slug, NOT: id ? { id } : undefined }, select: { id: true } })) return fail("Deze slug is al in gebruik door een ander artikel (mogelijk in de prullenbak).", { slug: "Bestaat al" });
    const image = opt(form, "image");
    const imageAlt = str(form, "imageAlt");
    if (image && !imageAlt) return fail("Geef de uitgelichte afbeelding een alt-tekst: beschrijf wat er te zien is.", { imageAlt: "Verplicht bij een afbeelding" });

    // status: concept, gepland (datum in de toekomst) of gepubliceerd
    const choice = str(form, "status");
    const dateRaw = str(form, "publishedAt");
    let publishedAt = old && dateRaw === localInput(old.publishedAt) ? old.publishedAt : dateRaw ? new Date(dateRaw) : new Date();
    if (Number.isNaN(publishedAt.getTime())) return fail("De publicatiedatum is ongeldig.", { publishedAt: "Ongeldig" });
    const now = Date.now();
    if (choice === "scheduled" && publishedAt.getTime() <= now) return fail("Kies bij Gepland een publicatiedatum in de toekomst.", { publishedAt: "Moet in de toekomst liggen" });
    // "Gepubliceerd" betekent nu zichtbaar: een toekomstige datum zetten we terug naar nu
    if (choice === "published" && publishedAt.getTime() > now) publishedAt = new Date();
    const status = choice === "draft" ? "draft" : "published";

    const newCategory = str(form, "newCategory");
    const categoryId = newCategory ? await categoryByName(newCategory) : opt(form, "categoryId");
    const tags = [...new Set(str(form, "tags").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 20);
    const data = {
      slug,
      path,
      title,
      excerpt: str(form, "excerpt"),
      content: cleanHtml(str(form, "content")),
      image,
      imageAlt,
      categoryId,
      tags: JSON.stringify(tags),
      authorName: str(form, "authorName") || "BluePure Marine",
      status,
      noindex: bool(form, "noindex"),
      metaTitle: opt(form, "metaTitle"),
      metaDescription: opt(form, "metaDescription"),
      publishedAt,
    };
    const planned = status === "published" && publishedAt.getTime() > now;
    if (id) {
      await ensureBaseline("post", id, user);
      await db.post.update({ where: { id }, data });
      await redirectOnMove(old?.path, path);
      await snapshot("post", id, user);
      await audit(user, "gewijzigd", "Blogartikel", id, `${title} bijgewerkt`);
      refresh(path, old?.path, "/blog/");
      return { ok: true, message: planned ? `Opgeslagen. Het artikel verschijnt automatisch op ${publishedAt.toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam", dateStyle: "long", timeStyle: "short" })}.` : "Opgeslagen. Het artikel is direct bijgewerkt op de website." };
    }
    const created = await db.post.create({ data });
    await snapshot("post", created.id, user);
    await audit(user, "aangemaakt", "Blogartikel", created.id, `${title} aangemaakt`);
    refresh(path, "/blog/");
    redirect(`/admin/blog/${created.id}/bewerken/?nieuw=1`);
  } catch (e) {
    if (isRedirect(e)) throw e;
    return caught(e);
  }
}

export async function bulkPosts(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const action = str(form, "bulk");
    const picked = form.getAll("ids").map(String);
    const ids = str(form, "scope") === "all" ? parse<string[]>(str(form, "allIds"), picked) : picked;
    if (!ids.length) return fail("Selecteer eerst artikelen.");
    let ok = 0;
    let bad = 0;
    for (const id of ids) {
      try {
        if (action === "publish" || action === "draft") {
          await ensureBaseline("post", id, user);
          const p = await db.post.findUniqueOrThrow({ where: { id }, select: { publishedAt: true } });
          // publiceren = nu zichtbaar: een geplande datum in de toekomst wordt vandaag
          await db.post.update({ where: { id }, data: action === "publish" ? { status: "published", ...(p.publishedAt.getTime() > Date.now() ? { publishedAt: new Date() } : {}) } : { status: "draft" } });
          await snapshot("post", id, user);
        } else if (action === "trash") await setDeleted("post", id, true);
        else throw new Error("onbekende actie");
        ok++;
      } catch {
        bad++;
      }
    }
    await audit(user, action === "trash" ? "verwijderd" : "gewijzigd", "Blogartikel", null, `Bulkactie "${action}" op ${ids.length} artikelen (${ok} gelukt, ${bad} mislukt)`);
    refresh("/blog/");
    return { ok: true, message: `${ok} gelukt${bad ? `, ${bad} mislukt` : ""}.` };
  } catch (e) {
    return caught(e, "Bulkactie mislukt");
  }
}

// ---------- blogcategorieën ----------
export async function saveBlogCategory(id: string | null, _: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const name = str(form, "name");
    if (name.length < 2) return fail("Vul een naam in.");
    const slug = slugify(str(form, "slug") || name);
    if (!slug) return fail("Vul een geldige slug in.");
    if (await db.blogCategory.findFirst({ where: { slug, NOT: id ? { id } : undefined }, select: { id: true } })) return fail("Er bestaat al een blogcategorie met deze slug.");
    if (id) await db.blogCategory.update({ where: { id }, data: { name, slug } });
    else await db.blogCategory.create({ data: { name, slug } });
    await audit(user, id ? "gewijzigd" : "aangemaakt", "Blogcategorie", id, `${name} ${id ? "bijgewerkt" : "aangemaakt"}`);
    refresh("/blog/");
    return { ok: true, message: id ? "Opgeslagen." : `Categorie "${name}" toegevoegd.` };
  } catch (e) {
    return caught(e);
  }
}

/** Blogcategorie verwijderen; de artikelen blijven bestaan, zonder categorie. */
export async function deleteBlogCategory(id: string) {
  const user = await assertRole("user");
  const c = await db.blogCategory.delete({ where: { id } });
  await audit(user, "verwijderd", "Blogcategorie", id, `${c.name} verwijderd`);
  refresh("/blog/");
}
