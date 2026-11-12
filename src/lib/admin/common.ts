import "server-only";
import { revalidatePath } from "next/cache";
import { db } from "../db";

export const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
export const opt = (f: FormData, k: string) => str(f, k) || null;
export const num = (f: FormData, k: string) => {
  const v = str(f, k).replace(",", ".");
  return v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null;
};
export const bool = (f: FormData, k: string) => f.get(k) === "on" || f.get(k) === "true";
export const statusOf = (f: FormData) => (str(f, "status") === "draft" ? "draft" : "published");

/** URL-pad valideren: kleine letters, koppeltekens, slash aan begin en eind. */
export function normalizePath(p: string) {
  let v = p.trim().toLowerCase().replace(/\s+/g, "-");
  if (!v.startsWith("/")) v = `/${v}`;
  if (!v.endsWith("/")) v += "/";
  return /^\/([a-z0-9-]+\/)*$/.test(v) ? v : null;
}

/** Eerste padsegmenten die bij vaste onderdelen van de site horen: geen pagina of categorie mag daar staan. */
export const RESERVED_SEGMENTS = ["admin", "api", "producten", "merken", "blog", "zoeken", "winkelwagen", "afrekenen", "bestelling", "account", "uploads", "og", "brands", "_next"];

type Owner = { table: string; id?: string | null };

/**
 * Valt dit pad onder een gereserveerd onderdeel? Producten (/producten/<slug>/) en blogs (/blog/<slug>/) mogen
 * alleen hun eigen voorvoegsel gebruiken; pagina's en categorieën mogen geen enkel gereserveerd segment gebruiken.
 */
export function reservedPath(path: string, table?: string) {
  const seg = path.split("/")[1] ?? "";
  if (!RESERVED_SEGMENTS.includes(seg)) return false;
  if ((!table || table === "product") && /^\/producten\/[a-z0-9-]+\/$/.test(path)) return false;
  if ((!table || table === "post") && /^\/blog\/[a-z0-9-]+\/$/.test(path)) return false;
  return true;
}

/**
 * Is dit pad al in gebruik door andere content (pagina, categorie, product of blog; ook in de prullenbak, want die
 * kan terugkomen) of gereserveerd? Geef bij `except` de eigen tabel mee ("page" | "category" | "product" | "post")
 * en, bij een bestaand item, het id.
 */
export async function pathTaken(path: string, except?: Owner) {
  if (reservedPath(path, except?.table)) return true;
  const find = { where: { path }, select: { id: true } } as const;
  const [page, category, product, post] = await Promise.all([db.page.findFirst(find), db.category.findFirst(find), db.product.findFirst(find), db.post.findFirst(find)]);
  const hits = [page && { table: "page", id: page.id }, category && { table: "category", id: category.id }, product && { table: "product", id: product.id }, post && { table: "post", id: post.id }];
  return hits.some((c) => c && !(except && c.table === except.table && c.id === except.id));
}

/** Pad gewijzigd? Dan automatisch een 301 van oud naar nieuw (SEO behouden). */
export async function redirectOnMove(oldPath: string | undefined, newPath: string) {
  if (!oldPath || oldPath === newPath) return;
  await db.redirect.deleteMany({ where: { from: newPath } });
  await db.redirect.upsert({ where: { from: oldPath }, create: { from: oldPath, to: newPath }, update: { to: newPath } });
  await db.redirect.updateMany({ where: { to: oldPath }, data: { to: newPath } });
}

/** Publieke pagina's opnieuw laten renderen na een wijziging. */
export function refresh(...paths: (string | null | undefined)[]) {
  for (const p of paths) if (p) revalidatePath(p);
  revalidatePath("/", "layout");
}

/** Date → waarde voor <input type="datetime-local"> (lokale tijd). */
export const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export const isRedirect = (e: unknown) => !!(e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT");
