import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { db } from "../db";
import { slugify } from "../text";

/** Upload → automatisch verkleind (max. 1600px) en als WebP opgeslagen in /uploads/, met alt-tekst in de mediabibliotheek. */
export async function saveUpload(file: File, alt = "") {
  if (!file.type.startsWith("image/")) throw new Error("Alleen afbeeldingen zijn toegestaan.");
  if (file.size > 20 * 1024 * 1024) throw new Error("Bestand is groter dan 20 MB.");
  const base = slugify(file.name.replace(/\.[^.]+$/, "")) || "afbeelding";
  let name = `${base}.webp`;
  const dir = path.join(process.cwd(), "public", "uploads");
  for (let i = 2; await fs.stat(path.join(dir, name)).then(() => true, () => false); i++) name = `${base}-${i}.webp`;
  const out = await sharp(Buffer.from(await file.arrayBuffer())).rotate().resize({ width: 1600, height: 2000, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
  await fs.writeFile(path.join(dir, name), out.data);
  const autoAlt = alt || base.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  return db.media.create({ data: { path: `/uploads/${name}`, alt: autoAlt, width: out.info.width, height: out.info.height, size: out.info.size } });
}
