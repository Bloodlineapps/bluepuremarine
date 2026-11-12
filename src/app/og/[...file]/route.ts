import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// og:image op 1200×630: snijdt een afbeelding uit /uploads/ bij.
// /og/products/exterior-cleaner-1.jpg ↔ /uploads/products/exterior-cleaner-1.webp. Bestaat de afbeelding niet (meer),
// of wordt /og/default.jpg gevraagd, dan komt de vaste deelafbeelding public/og-default.jpg terug.
// Productfoto's (vrijstaand op wit) worden passend gemaakt op een witte achtergrond in plaats van bijgesneden.

const UPLOADS = path.join(process.cwd(), "public", "uploads");
const FALLBACK = path.join(process.cwd(), "public", "og-default.jpg");

async function fallback() {
  try {
    return new Response(new Uint8Array(await fs.readFile(FALLBACK)), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" } });
  } catch {
    return new Response("Niet gevonden", { status: 404 });
  }
}

export async function GET(_: Request, { params }: { params: Promise<{ file: string[] }> }) {
  const parts = (await params).file.map((p) => decodeURIComponent(p));
  if (!parts.length || parts.some((p) => !/^[a-z0-9][a-z0-9._-]*$/i.test(p))) return new Response("Niet gevonden", { status: 404 });
  parts[parts.length - 1] = parts[parts.length - 1].replace(/\.jpg$/i, "");
  if (parts.length === 1 && parts[0] === "default") return fallback();
  const rel = parts;
  const base = path.join(UPLOADS, ...rel);
  if (!base.startsWith(UPLOADS + path.sep)) return new Response("Niet gevonden", { status: 404 });
  const contain = rel[0] === "products";
  for (const file of [`${base}.webp`, base, `${base}.jpg`, `${base}.png`]) {
    try {
      const out = await sharp(await fs.readFile(file))
        .flatten({ background: "#ffffff" })
        .resize(1200, 630, contain ? { fit: "contain", background: "#ffffff" } : { fit: "cover", position: "attention" })
        .jpeg({ quality: 82 })
        .toBuffer();
      return new Response(new Uint8Array(out), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=604800, immutable" } });
    } catch {
      /* volgende kandidaat proberen */
    }
  }
  return fallback();
}
