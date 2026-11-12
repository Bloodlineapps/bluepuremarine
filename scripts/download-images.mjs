// Downloadt de afbeeldingen uit content/images.json (gemaakt door scripts/parse.mjs) naar public/:
//   - foto's (producten, sfeerbeelden) → WebP, max. 1600 px breed, kwaliteit 82
//   - merklogo's (svg/png) → ongewijzigd naar public/brands/
// en schrijft breedte, hoogte en bestandsgrootte terug in content/images.json (de seed maakt er Media-rijen van).
// Maakt daarna de iconen en de standaard deelafbeelding uit public/logo.svg.
// Bestaande bestanden worden overgeslagen; maximaal 4 downloads tegelijk. Gebruik: npm run images
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = path.join(root, "public");
const listFile = path.join(root, "content", "images.json");
const list = JSON.parse(fs.readFileSync(listFile, "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Haalt een bestand op; bij 429/5xx even wachten en opnieuw, daarna de reserve-URL (dezelfde afbeelding op de andere host). */
async function get(urls) {
  let last = "";
  for (const url of urls.filter(Boolean)) {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (content migration)", Accept: "image/avif,image/webp,image/png,image/svg+xml,image/*,*/*" } });
        if (res.ok) return Buffer.from(await res.arrayBuffer());
        last = `HTTP ${res.status} ${url}`;
        if (res.status !== 429 && res.status < 500) break;
        await sleep(1500 * (attempt + 1) + Number(res.headers.get("retry-after") ?? 0) * 1000);
      } catch (e) {
        last = `${e.message} ${url}`;
        await sleep(1000 * (attempt + 1));
      }
    }
  }
  throw new Error(last);
}

const failed = [];
let done = 0;
async function handle(item) {
  const outFile = path.join(pub, item.dest);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  try {
    if (!fs.existsSync(outFile)) {
      const buf = await get([item.src, item.fallback]);
      if (item.kind === "raw") fs.writeFileSync(outFile, buf);
      else await sharp(buf).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82, alphaQuality: 100 }).toFile(outFile);
      done++;
      if (done % 20 === 0) console.log(`  ${done} gedownload…`);
    }
    const m = await sharp(outFile).metadata();
    item.width = m.width ?? null;
    item.height = m.height ?? null;
    item.size = fs.statSync(outFile).size;
  } catch (e) {
    failed.push(`${item.dest}: ${e.message}`);
  }
}

// maximaal 4 tegelijk
const queue = [...list];
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length) await handle(queue.shift());
}));
fs.writeFileSync(listFile, JSON.stringify(list, null, 2) + "\n");

// ---------- iconen en deelafbeelding uit het logo ----------
const logo = fs.readFileSync(path.join(pub, "logo.svg"));
const white = { r: 255, g: 255, b: 255, alpha: 1 };
/** Vierkant icoon: het logo gecentreerd op wit, met wat lucht eromheen. */
async function icon(size, file) {
  const inner = Math.round(size * 0.84);
  const mark = await sharp(logo, { density: 300 }).resize({ width: inner, height: inner, fit: "inside" }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: white } }).composite([{ input: mark, gravity: "centre" }]).png().toFile(file);
}
await icon(256, path.join(root, "src", "app", "icon.png"));
await icon(256, path.join(pub, "icon.png"));
await icon(512, path.join(pub, "icon-512.png"));
await icon(180, path.join(pub, "apple-touch-icon.png"));

// og-default.jpg: 1200×630, logo op een verloop van wit naar lichtblauw
const bg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dcebfa"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/><rect y="618" width="1200" height="12" fill="#0050B0"/></svg>`,
);
const big = await sharp(logo, { density: 300 }).resize({ width: 760, height: 420, fit: "inside" }).png().toBuffer();
await sharp(bg).composite([{ input: big, gravity: "centre" }]).jpeg({ quality: 88 }).toFile(path.join(pub, "og-default.jpg"));

const ok = list.filter((i) => i.width).length;
console.log(`Klaar: ${ok} van ${list.length} afbeeldingen (${done} nieuw gedownload) + iconen en og-default.jpg.`);
if (failed.length) {
  console.log(`${failed.length} mislukt:`);
  for (const f of failed) console.log(" -", f);
  process.exitCode = 1;
}
