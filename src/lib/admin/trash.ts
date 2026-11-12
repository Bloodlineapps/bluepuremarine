import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { db } from "../db";

// Prullenbak: verwijderen zet deletedAt. Items blijven 6 maanden bewaard en worden daarna automatisch
// definitief verwijderd (bij het openen van het dashboard of de prullenbak).

export const KEEP_DAYS = 182;
const DAY = 86_400_000;

export const daysLeft = (deletedAt: Date) => Math.max(0, Math.ceil((deletedAt.getTime() + KEEP_DAYS * DAY - Date.now()) / DAY));

export type TrashType = "page" | "faq" | "form" | "product" | "category" | "post";
export const TRASH_TYPES: TrashType[] = ["page", "faq", "form", "product", "category", "post"];
export const isTrashType = (v: string): v is TrashType => (TRASH_TYPES as string[]).includes(v);

export type TrashItem = { type: TrashType; id: string; title: string; detail: string; deletedAt: Date };

export async function trashItems(): Promise<TrashItem[]> {
  const where = { deletedAt: { not: null } };
  const [pages, faqs, forms, products, categories, posts] = await Promise.all([
    db.page.findMany({ where, select: { id: true, title: true, path: true, deletedAt: true } }),
    db.faq.findMany({ where, select: { id: true, question: true, category: true, deletedAt: true } }),
    db.form.findMany({ where, select: { id: true, name: true, key: true, deletedAt: true } }),
    db.product.findMany({ where, select: { id: true, name: true, path: true, deletedAt: true } }),
    db.category.findMany({ where, select: { id: true, name: true, path: true, deletedAt: true } }),
    db.post.findMany({ where, select: { id: true, title: true, path: true, deletedAt: true } }),
  ]);
  return [
    ...pages.map((p) => ({ type: "page" as const, id: p.id, title: p.title, detail: p.path, deletedAt: p.deletedAt! })),
    ...faqs.map((p) => ({ type: "faq" as const, id: p.id, title: p.question, detail: p.category, deletedAt: p.deletedAt! })),
    ...forms.map((p) => ({ type: "form" as const, id: p.id, title: p.name, detail: p.key, deletedAt: p.deletedAt! })),
    ...products.map((p) => ({ type: "product" as const, id: p.id, title: p.name, detail: p.path, deletedAt: p.deletedAt! })),
    ...categories.map((p) => ({ type: "category" as const, id: p.id, title: p.name, detail: p.path, deletedAt: p.deletedAt! })),
    ...posts.map((p) => ({ type: "post" as const, id: p.id, title: p.title, detail: p.path, deletedAt: p.deletedAt! })),
  ].sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
}

/** Aantal items in de prullenbak (voor het bolletje in het menu). */
export async function trashCount() {
  const where = { deletedAt: { not: null } };
  const counts = await Promise.all([db.page.count({ where }), db.faq.count({ where }), db.form.count({ where }), db.product.count({ where }), db.category.count({ where }), db.post.count({ where })]);
  return counts.reduce((a, b) => a + b, 0);
}

/** Naar de prullenbak (deleted = true) of herstellen (false). Geeft titel/naam en, waar van toepassing, het pad terug. */
export async function setDeleted(type: TrashType, id: string, deleted: boolean): Promise<{ title: string; path: string | null }> {
  const data = { deletedAt: deleted ? new Date() : null };
  switch (type) {
    case "page": {
      const r = await db.page.update({ where: { id }, data, select: { path: true, title: true } });
      return { title: r.title, path: r.path };
    }
    case "faq": {
      const r = await db.faq.update({ where: { id }, data, select: { question: true } });
      return { title: r.question, path: "/veelgestelde-vragen/" };
    }
    case "form": {
      const r = await db.form.update({ where: { id }, data, select: { name: true } });
      return { title: r.name, path: null };
    }
    case "product": {
      const r = await db.product.update({ where: { id }, data, select: { path: true, name: true } });
      return { title: r.name, path: r.path };
    }
    case "category": {
      const r = await db.category.update({ where: { id }, data, select: { path: true, name: true } });
      return { title: r.name, path: r.path };
    }
    case "post": {
      const r = await db.post.update({ where: { id }, data, select: { path: true, title: true } });
      return { title: r.title, path: r.path };
    }
    default:
      throw new Error("Onbekend type.");
  }
}

/** Definitief verwijderen, inclusief revisies (en bij formulieren de inzendingen met bijlagen). */
export async function destroy(type: TrashType, id: string) {
  await db.revision.deleteMany({ where: { entity: type, entityId: id } });
  switch (type) {
    case "page":
      return db.page.delete({ where: { id } });
    case "faq":
      return db.faq.delete({ where: { id } });
    case "product":
      // varianten en categorie-koppelingen verdwijnen mee; reviews en bestelregels blijven (zonder koppeling) bestaan
      return db.product.delete({ where: { id } });
    case "category":
      // subcategorieën en producten blijven bestaan, maar zijn dan niet meer aan deze categorie gekoppeld
      return db.category.delete({ where: { id } });
    case "post":
      return db.post.delete({ where: { id } });
    case "form": {
      const subs = await db.formSubmission.findMany({ where: { formId: id }, select: { id: true } });
      for (const s of subs) await fs.rm(path.join(process.cwd(), "storage", "forms", s.id), { recursive: true, force: true });
      return db.form.delete({ where: { id } });
    }
    default:
      throw new Error("Onbekend type.");
  }
}

/** Alles wat langer dan 6 maanden in de prullenbak ligt definitief verwijderen. */
export async function purgeExpired() {
  const before = new Date(Date.now() - KEEP_DAYS * DAY);
  const items = (await trashItems()).filter((i) => i.deletedAt < before);
  let n = 0;
  for (const i of items) {
    try {
      await destroy(i.type, i.id);
      n++;
    } catch {
      /* blijft staan en wordt de volgende keer opnieuw geprobeerd */
    }
  }
  return n;
}
