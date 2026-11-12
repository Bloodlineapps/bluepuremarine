// SEO-controle op de productie-build van de webshop. Start zelf `next start` op een vrije poort (build uit
// NEXT_DIST_DIR, anders .next-prod als die bestaat, anders .next), leest de sitemap-index en de vier deelsitemaps,
// controleert elke URL daaruit en volgt alle interne links. Faalt (exit 1) bij fouten; het volledige rapport met
// fouten, waarschuwingen en cijfers per pagina staat in seo-report.json.
//
// Gebruik:  npm run seo:check                 controle op de bestaande build
//           npm run build:check               eerst bouwen in .next-prod, dan controleren (= --build)
//           SEO_BASE=http://localhost:3800    een al draaiende server controleren (er wordt niets gestart)
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const line of fs.existsSync(path.join(root, ".env")) ? fs.readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/) : []) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/.exec(line);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}

const SITE = (process.env.SITE_URL || "https://www.bluepuremarine.com").replace(/\/$/, "");
const SITE_HOST = new URL(SITE).host;
const BRAND = "BluePure Marine";
const PREVIEW_HOST = "bluepuremarine.replit.app";
const SITEMAPS = { paginas: "/sitemap-paginas.xml", categorieen: "/sitemap-categorieen.xml", producten: "/sitemap-producten.xml", blog: "/sitemap-blog.xml" };
const ROBOTS_DISALLOW = ["/admin/", "/api/", "/winkelwagen/", "/afrekenen/", "/bestelling/", "/account/", "/zoeken/"];
const AI_BOTS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-Web", "anthropic-ai", "PerplexityBot", "Google-Extended", "CCBot", "Applebot-Extended", "Bytespider"];
const NOINDEX_PATHS = ["/zoeken/", "/zoeken/?q=poets", "/winkelwagen/", "/afrekenen/", "/account/inloggen/", "/admin/login/"];
const OLD_URLS = ["/products/exterior-cleaner", "/collections/blokken", "/pages/contact"];
const PLACEHOLDERS = [
  /voorbeeldsite/i,
  /voorbeeldbedrijf/i,
  /voorbeeldstraat/i,
  /voorbeeldstad/i,
  /1234 ?AB/,
  /\+31-20-000-0000/,
  /lorem ipsum/i,
  /GTM-XXXXXXX(?![\w-])/,
  /G-XXXXXXXXXX/,
  /security control/i,
  /securitycontrol/i,
  /psycholoog/i,
];
const GENERIC_ANCHOR = /^(klik hier|klik|hier|lees meer|lees verder|meer|meer info|meer informatie|meer lezen|bekijk|bekijken|link|click here|read more)[\s.…›»→>]*$/i;
const SKELETON = [/<!--\$\?-->/, /BAILOUT_TO_CLIENT_SIDE_RENDERING/, /aria-busy="true"/, /class="[^"]*\b(skeleton|animate-pulse)\b/, />\s*(Laden|Bezig met laden|Loading)\s*(\.\.\.|…)?\s*</];
const MIN_WORDS = 300;
const MIN_INLINKS = 3;
const MAX_DEPTH = 3;

const errors = [];
const warnings = [];
const err = (url, msg) => errors.push(`${url}  ${msg}`);
const warn = (url, msg) => warnings.push(`${url}  ${msg}`);

let BASE = process.env.SEO_BASE?.replace(/\/$/, "");
const agents = { "http:": new http.Agent({ keepAlive: true, maxSockets: 16 }), "https:": new https.Agent({ keepAlive: true, maxSockets: 16 }) };

/**
 * Eén verzoek zonder redirects te volgen. Standaard met de Host van het productiedomein en x-forwarded-proto https,
 * zodat de server antwoordt zoals in productie (geen X-Robots-Tag noindex, geen redirect naar https).
 */
function request(p, { host = SITE_HOST, proto = "https", binary = false } = {}) {
  const u = new URL(BASE + p);
  const lib = u.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request(
      { protocol: u.protocol, hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: "GET", agent: agents[u.protocol], headers: { Host: host, "x-forwarded-proto": proto, "x-forwarded-host": host, Accept: "text/html,*/*", "User-Agent": "seo-check" } },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const body = Buffer.concat(chunks);
          resolve({
            status: res.statusCode ?? 0,
            location: res.headers.location ?? null,
            type: String(res.headers["content-type"] ?? ""),
            xRobots: String(res.headers["x-robots-tag"] ?? ""),
            body,
            text: binary ? "" : body.toString("utf8"),
          });
        });
      },
    );
    req.setTimeout(60_000, () => req.destroy(new Error(`timeout ${p}`)));
    req.on("error", reject);
    req.end();
  });
}

async function get(p, opts) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await request(p, opts);
    } catch (e) {
      if (attempt >= 2) throw e;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

/** Location-header terugbrengen tot een pad op de eigen site (null = ander domein). */
function localPath(location) {
  if (!location) return null;
  if (location.startsWith("/")) return location;
  try {
    const u = new URL(location);
    if (u.host === SITE_HOST || u.host === new URL(BASE).host || u.hostname === "localhost" || u.hostname === "0.0.0.0") return u.pathname + u.search;
  } catch {
    /* ongeldige URL */
  }
  return null;
}

/** Volgt redirects (max. 5) en geeft de keten terug. */
async function follow(p, opts) {
  const chain = [];
  let cur = p;
  for (let i = 0; i < 6; i++) {
    const r = await get(cur, opts);
    chain.push({ path: cur, status: r.status, location: r.location });
    if (r.status < 300 || r.status >= 400) return { chain, final: r, finalPath: cur };
    const next = localPath(r.location);
    if (!next) return { chain, final: r, finalPath: cur };
    cur = next;
  }
  return { chain, final: null, finalPath: cur };
}

async function pool(items, n, fn) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (queue.length) await fn(queue.shift());
    }),
  );
}

const freePort = () =>
  new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

function distDir() {
  if (process.env.NEXT_DIST_DIR) return process.env.NEXT_DIST_DIR;
  return fs.existsSync(path.join(root, ".next-prod", "BUILD_ID")) ? ".next-prod" : ".next";
}

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

/** `--build`: productie-build in een eigen map (.next-prod), zodat een draaiende dev-server (.next) ongestoord blijft. */
function build() {
  const dir = process.env.NEXT_DIST_DIR || ".next-prod";
  // Prisma-client alleen genereren als hij ontbreekt of ouder is dan het schema. Op Windows is de Prisma-DLL
  // gelockt zolang de dev-server draait; een bestaande, actuele client blijft daarom met rust.
  const client = path.join(root, "node_modules", ".prisma", "client", "index.js");
  const schema = path.join(root, "prisma", "schema.prisma");
  if (!fs.existsSync(client) || fs.statSync(client).mtimeMs < fs.statSync(schema).mtimeMs) {
    const gen = spawnSync(process.execPath, ["scripts/prisma.mjs", "generate"], { cwd: root, stdio: "inherit", env: process.env });
    if (gen.status !== 0) throw new Error("Prisma-client genereren mislukt (draait er nog een server die de client gebruikt?)");
  } else console.log("[seo] Prisma-client is actueel: niet opnieuw gegenereerd");
  console.log(`[seo] next build → ${dir}`);
  // next build herschrijft next-env.d.ts naar de build-map; na afloop terugzetten zodat de dev-server (.next) klopt.
  const envDts = path.join(root, "next-env.d.ts");
  const before = fs.existsSync(envDts) ? fs.readFileSync(envDts, "utf8") : null;
  const r = spawnSync(process.execPath, [nextBin, "build"], { cwd: root, stdio: "inherit", env: { ...process.env, NEXT_DIST_DIR: dir, NODE_ENV: "production" } });
  if (before !== null && dir !== ".next") fs.writeFileSync(envDts, before);
  if (r.status !== 0) throw new Error("next build mislukt");
  process.env.NEXT_DIST_DIR = dir;
}

async function startServer() {
  if (BASE) return null;
  const dir = distDir();
  if (!fs.existsSync(path.join(root, dir, "BUILD_ID"))) throw new Error(`Geen productie-build in ${dir}; draai eerst npm run build:check (of npm run build).`);
  const port = await freePort();
  // Rechtstreeks node (geen shell), zodat kill() het serverproces zelf stopt, ook op Windows.
  const child = spawn(process.execPath, [nextBin, "start", "-p", String(port)], { cwd: root, env: { ...process.env, NEXT_DIST_DIR: dir, NODE_ENV: "production", PORT: String(port) }, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  let exited = false;
  child.on("exit", () => (exited = true));
  BASE = `http://127.0.0.1:${port}`;
  console.log(`[seo] next start (${dir}) op ${BASE}`);
  for (let i = 0; i < 120 && !exited; i++) {
    try {
      const r = await request("/robots.txt");
      if (r.status === 200) return { child, log: () => log };
    } catch {
      /* nog niet klaar */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  child.kill();
  throw new Error(`Productieserver start niet:\n${log}`);
}

const words = (s) => s.replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length;
const robotsOf = ($) => ($('meta[name="robots"]').attr("content") ?? "").toLowerCase();
const isAsset = (p) => /\.[a-z0-9]{2,5}$/i.test(p);

/** Alle JSON-LD-knooppunten van een pagina (plat: de inhoud van @graph of het object zelf). */
function jsonLd($, p) {
  const nodes = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const j = JSON.parse($(el).html() ?? "");
      for (const item of [].concat(j)) nodes.push(...[].concat(item["@graph"] ?? item));
    } catch {
      err(p, "ongeldige JSON-LD (geen geldige JSON)");
    }
  });
  return nodes;
}
const ofType = (nodes, type) => nodes.filter((n) => [].concat(n?.["@type"] ?? []).includes(type));

async function main() {
  if (process.argv.includes("--build")) build();
  const server = await startServer();
  const report = { checkedAt: new Date().toISOString(), site: SITE, base: "", sitemaps: {}, urls: 0, crawled: 0, errors, warnings, thin: [], pages: [] };
  try {
    report.base = BASE;

    // ---------- robots.txt ----------
    const robots = await get("/robots.txt");
    if (robots.status !== 200) err("/robots.txt", `status ${robots.status}`);
    {
      const lines = robots.text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
      const groups = [];
      let cur = null;
      let lastWasAgent = false;
      for (const l of lines) {
        const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(l);
        if (!m) continue;
        const [key, value] = [m[1].toLowerCase(), m[2].trim()];
        if (key === "user-agent") {
          if (!lastWasAgent) groups.push((cur = { agents: [], allow: [], disallow: [] }));
          cur.agents.push(value);
          lastWasAgent = true;
          continue;
        }
        lastWasAgent = false;
        if (key === "allow" && cur) cur.allow.push(value);
        if (key === "disallow" && cur) cur.disallow.push(value);
      }
      const all = groups.find((g) => g.agents.includes("*"));
      if (!all) err("/robots.txt", "geen groep voor User-agent: *");
      else {
        if (!all.allow.includes("/")) err("/robots.txt", "Allow: / ontbreekt");
        for (const d of all.disallow) {
          if (d === "/" || d === "/*") err("/robots.txt", "Disallow: / voor alle crawlers");
          else if (!ROBOTS_DISALLOW.includes(d)) err("/robots.txt", `onverwachte Disallow: ${d}`);
        }
        for (const d of ROBOTS_DISALLOW) if (!all.disallow.includes(d)) err("/robots.txt", `Disallow: ${d} ontbreekt`);
      }
      for (const g of groups) {
        if (g.agents.includes("*")) continue;
        const bots = g.agents.filter((a) => AI_BOTS.some((b) => b.toLowerCase() === a.toLowerCase()));
        if (bots.length && g.disallow.some((d) => d)) err("/robots.txt", `AI-crawler geblokkeerd: ${bots.join(", ")}`);
        if (g.disallow.includes("/")) err("/robots.txt", `Disallow: / voor ${g.agents.join(", ")}`);
      }
      const sitemapLines = lines.filter((l) => /^sitemap\s*:/i.test(l)).map((l) => l.replace(/^sitemap\s*:\s*/i, ""));
      if (sitemapLines.length !== 1 || sitemapLines[0] !== `${SITE}/sitemap.xml`) err("/robots.txt", `Sitemap-regel moet ${SITE}/sitemap.xml zijn, gevonden: ${sitemapLines.join(", ") || "geen"}`);
      // Disallow alleen voor paden die bestaan: de route staat in src/app (bv. /bestelling/ geeft zonder
      // bestelnummer terecht een 404), of het pad geeft zelf geen 404.
      for (const d of all?.disallow ?? []) {
        const seg = d.split("/")[1];
        if (!seg || ["src/app", "src/app/(site)"].some((dir) => fs.existsSync(path.join(root, dir, seg)))) continue;
        const r = await follow(d);
        if (!r.final || r.final.status === 404) err("/robots.txt", `Disallow voor een pad dat niet bestaat: ${d} (status ${r.final?.status ?? "redirectlus"})`);
      }
    }

    // ---------- sitemaps ----------
    const inSitemap = new Map(); // pad → { loc, lastmod, kind }
    {
      const index = await get("/sitemap.xml");
      if (index.status !== 200) err("/sitemap.xml", `status ${index.status}`);
      if (!/xml/.test(index.type)) err("/sitemap.xml", `content-type ${index.type}`);
      if (!/<sitemapindex/.test(index.text)) err("/sitemap.xml", "is geen sitemap-index");
      const children = [...index.text.matchAll(/<sitemap>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?\s*<\/sitemap>/g)].map((m) => ({ loc: m[1], lastmod: m[2] }));
      for (const [kind, file] of Object.entries(SITEMAPS)) if (!children.some((c) => c.loc === `${SITE}${file}`)) err("/sitemap.xml", `${SITE}${file} ontbreekt in de index`);
      for (const c of children) {
        if (!c.loc.startsWith(`${SITE}/`)) {
          err("/sitemap.xml", `deelsitemap op een ander domein: ${c.loc}`);
          continue;
        }
        if (!c.lastmod) err("/sitemap.xml", `geen lastmod bij ${c.loc}`);
        const file = c.loc.slice(SITE.length);
        const kind = Object.entries(SITEMAPS).find(([, f]) => f === file)?.[0] ?? file;
        const sm = await get(file);
        if (sm.status !== 200) {
          err(file, `status ${sm.status}`);
          continue;
        }
        if (/<changefreq>|<priority>/.test(sm.text)) err(file, "bevat changefreq of priority");
        const urls = [...sm.text.matchAll(/<url>(.*?)<\/url>/gs)];
        report.sitemaps[file] = urls.length;
        if (!urls.length) err(file, "lege sitemap");
        if (urls.length > 50_000) err(file, `${urls.length} URL's (maximaal 50.000 per sitemap)`);
        for (const u of urls) {
          const loc = /<loc>([^<]+)<\/loc>/.exec(u[1])?.[1]?.replace(/&amp;/g, "&");
          const lastmod = /<lastmod>([^<]+)<\/lastmod>/.exec(u[1])?.[1];
          if (!loc) {
            err(file, "url zonder loc");
            continue;
          }
          if (!loc.startsWith(`${SITE}/`)) {
            err(file, `URL niet op ${SITE}: ${loc}`);
            continue;
          }
          const p = loc.slice(SITE.length);
          if (!p.endsWith("/") || /[?#]/.test(p)) err(file, `URL zonder slash aan het eind of met query: ${loc}`);
          if (!lastmod) err(file, `geen lastmod bij ${loc}`);
          else if (Number.isNaN(Date.parse(lastmod))) err(file, `ongeldige lastmod bij ${loc}: ${lastmod}`);
          else if (Date.parse(lastmod) > Date.now() + 60_000) err(file, `lastmod in de toekomst bij ${loc}`);
          if (inSitemap.has(p)) err(file, `URL staat dubbel in de sitemaps: ${loc}`);
          else inSitemap.set(p, { loc, lastmod, kind });
        }
      }
      // lastmod moet de echte wijzigingsdatum zijn, niet voor alles het moment van de build of van het verzoek
      const mods = [...inSitemap.values()].map((v) => v.lastmod).filter(Boolean);
      const distinct = new Set(mods);
      const buildId = path.join(root, distDir(), "BUILD_ID");
      const builtAt = fs.existsSync(buildId) ? fs.statSync(buildId).mtimeMs : 0;
      const nearBuild = mods.filter((m) => Math.abs(Date.parse(m) - builtAt) < 15 * 60_000 || Math.abs(Date.parse(m) - Date.now()) < 5 * 60_000).length;
      if (mods.length > 5 && distinct.size === 1) err("/sitemap.xml", `alle ${mods.length} URL's hebben dezelfde lastmod (${mods[0]}): gebruik de echte updatedAt`);
      else if (mods.length > 5 && nearBuild === mods.length) err("/sitemap.xml", "alle lastmod-waarden liggen op het moment van de build/het verzoek: gebruik de echte updatedAt");
      else if (mods.length > 5 && distinct.size < mods.length / 10) warn("/sitemap.xml", `slechts ${distinct.size} verschillende lastmod-waarden voor ${mods.length} URL's`);
      if (!inSitemap.has("/")) err("/sitemap.xml", "de homepage ontbreekt");
    }
    report.urls = inSitemap.size;
    console.log(`[seo] ${inSitemap.size} URL's in de sitemaps (${Object.entries(report.sitemaps).map(([f, n]) => `${f}: ${n}`).join(", ")})`);

    // ---------- crawl: sitemap-URL's + alle interne links ----------
    const pages = new Map(); // url (pad + evt. query) → { status, location, noindex }
    const outLinks = new Map(); // pad → Set(doelpaden zonder query)
    const linkedFrom = new Map(); // doel-url → Set(bronpagina's)
    const titles = new Map();
    const descriptions = new Map();
    const ogImages = new Map(); // og:image-pad → eerste pagina
    const info = new Map(); // pad → cijfers voor het rapport
    const queue = [...new Set(["/", ...inSitemap.keys()])];
    const seen = new Set(queue);
    let faqPath = null;

    function collectLinks($, p, full) {
      const targets = new Set();
      $("a[href]").each((_, a) => {
        const href = ($(a).attr("href") ?? "").trim();
        if (/^(mailto:|tel:|sms:|javascript:|whatsapp:)/i.test(href)) return;
        if (href.startsWith("#")) {
          if (full && href.length > 1 && !$(`[id="${href.slice(1).replace(/"/g, "")}"]`).length) warn(p, `ankerlink naar een id dat niet op de pagina staat: ${href}`);
          return;
        }
        const label = ($(a).text().replace(/\s+/g, " ").trim() || $(a).attr("aria-label") || $(a).attr("title") || $(a).find("img[alt]").attr("alt") || "").trim();
        if (full) {
          if (!label) err(p, `link zonder ankertekst: ${href}`);
          else if (GENERIC_ANCHOR.test(label) && !$(a).attr("aria-label")) err(p, `nietszeggende ankertekst "${label}": ${href}`);
        }
        let local = href;
        if (/^(https?:)?\/\//i.test(href)) {
          let u;
          try {
            u = new URL(href, SITE);
          } catch {
            if (full) err(p, `ongeldige link: ${href}`);
            return;
          }
          if (/(^|\.)bluepuremarine\.com$/i.test(u.hostname)) {
            if (full) err(p, `interne link als absolute URL (gebruik een pad): ${href}`);
            local = u.pathname + u.search;
          } else {
            const rel = ($(a).attr("rel") ?? "").toLowerCase();
            if (full && ($(a).attr("target") !== "_blank" || !/\bnoopener\b/.test(rel) || !/\bnoreferrer\b/.test(rel))) err(p, `externe link zonder target="_blank" + rel="noopener noreferrer": ${href}`);
            return;
          }
        }
        if (!local.startsWith("/")) {
          if (full) err(p, `relatieve interne link (begin met /): ${href}`);
          return;
        }
        const noHash = local.split("#")[0];
        const clean = noHash.split("?")[0];
        if (isAsset(clean)) return;
        if (full && !clean.endsWith("/")) err(p, `interne link zonder slash aan het eind: ${href}`);
        if (clean.startsWith("/api/") || clean.startsWith("/_next/")) return;
        targets.add(clean.endsWith("/") ? clean : `${clean}/`);
        if (!linkedFrom.has(noHash)) linkedFrom.set(noHash, new Set());
        linkedFrom.get(noHash).add(p);
        if (!seen.has(noHash)) {
          seen.add(noHash);
          queue.push(noHash);
        }
      });
      return targets;
    }

    async function check(url) {
      const r = await get(url);
      const p = url.split("?")[0];
      const query = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
      const listed = !query && inSitemap.has(p);
      pages.set(url, { status: r.status, location: r.location, noindex: false });
      if (r.status !== 200) {
        if (listed) err(p, `staat in de sitemap maar geeft status ${r.status}${r.location ? ` → ${r.location}` : ""}`);
        return;
      }
      if (!r.type.includes("text/html")) {
        if (listed) err(p, `staat in de sitemap maar is geen HTML (${r.type})`);
        return;
      }
      const $ = cheerio.load(r.text);
      const robotsMeta = robotsOf($);
      const noindex = /noindex/.test(robotsMeta) || /noindex/i.test(r.xRobots);
      pages.get(url).noindex = noindex;

      // Links volgen: op sitemap-pagina's en op gepagineerde lijsten (?pagina=N); niet op filter-URL's of noindex-pagina's.
      const paginated = /^pagina=\d+$/.test(query);
      if (listed || (paginated && !noindex)) {
        const targets = collectLinks($, url, listed);
        const key = paginated ? url : p;
        outLinks.set(key, targets);
        if (paginated) targets.add(p); // gepagineerde pagina hoort bij de lijst zelf
      }
      if (paginated && !noindex) {
        // pagina 2 en verder: indexeerbaar, canonical naar zichzelf, paginanummer in de title
        const n = query.split("=")[1];
        const canon = $('link[rel="canonical"]').attr("href");
        if (canon !== `${SITE}${url}`) err(url, `gepagineerde URL: canonical ${canon} ≠ ${SITE}${url}`);
        if (!new RegExp(`pagina ${n}\\b`, "i").test($("title").first().text())) err(url, `gepagineerde URL zonder paginanummer in de title: ${$("title").first().text()}`);
        const t = $("title").first().text().trim();
        if (titles.has(t)) err(url, `dubbele title (ook op ${titles.get(t)}): ${t}`);
        else titles.set(t, url);
      }
      if (!listed) {
        if (!query && !noindex && !inSitemap.has(p)) warn(p, "indexeerbare pagina die niet in de sitemap staat");
        return;
      }

      // ----- volledige controle van een sitemap-URL -----
      const kind = inSitemap.get(p).kind;
      if (/noindex/i.test(r.xRobots)) err(p, `X-Robots-Tag "${r.xRobots}" terwijl de Host het productiedomein is`);
      if (noindex) err(p, "noindex-pagina staat in de sitemap");
      if (!/\bindex\b/.test(robotsMeta.replace(/noindex/g, "")) || !/\bfollow\b/.test(robotsMeta.replace(/nofollow/g, ""))) err(p, `meta robots is niet index,follow: "${robotsMeta}"`);

      // HTML-bron: echte inhoud zonder JavaScript
      for (const re of SKELETON) if (re.test(r.text)) err(p, `laadstatus/skeleton in de HTML-bron (${re})`);
      const lang = $("html").attr("lang");
      if (lang !== "nl") err(p, `<html lang="${lang}"> (verwacht nl)`);
      if ($("main").length !== 1) err(p, `${$("main").length} <main>-elementen`);
      if ($("body > header, body header").length < 1) err(p, "geen <header>");
      if ($("header nav, nav").length < 1) err(p, "geen <nav>");
      if ($("footer").length < 1) err(p, "geen <footer>");
      if ($("header a[href^='/']").length < 3) err(p, "navigatie in de header staat niet als links in de HTML");
      if ($("footer a[href^='/']").length < 3) err(p, "footer zonder interne links in de HTML");
      const h1 = $("h1");
      if (h1.length !== 1) err(p, `${h1.length} H1's`);
      else if (!h1.text().trim()) err(p, "lege H1");
      else if (!$("main h1").length) err(p, "H1 staat niet in <main>");
      const $main = $("main").first().clone();
      $main.find("script, style, noscript, template").remove();
      const mainText = $main.text().replace(/\s+/g, " ").trim();
      const wordCount = words(mainText);
      if (wordCount < 40) err(p, `nauwelijks tekst in de HTML-bron (${wordCount} woorden in <main>)`);
      else if (wordCount < MIN_WORDS) {
        warn(p, `dunne content (${wordCount} woorden in <main>, advies ≥ ${MIN_WORDS})`);
        report.thin.push({ url: p, words: wordCount });
      }
      // koppen: geen overgeslagen niveaus
      let prev = 0;
      const skipped = [];
      $("h1, h2, h3, h4, h5, h6").each((_, h) => {
        const level = Number(h.tagName[1]);
        if (prev && level > prev + 1) skipped.push(`h${prev}→h${level} "${$(h).text().replace(/\s+/g, " ").trim().slice(0, 40)}"`);
        prev = level;
      });
      if ($("h1, h2, h3, h4, h5, h6").first().prop("tagName") !== "H1") warn(p, `eerste kop is geen H1 maar ${$("h1, h2, h3, h4, h5, h6").first().prop("tagName")}`);
      if (skipped.length) warn(p, `overgeslagen kopniveau: ${skipped.slice(0, 3).join(", ")}${skipped.length > 3 ? ` (+${skipped.length - 3})` : ""}`);

      // title, description, meta-tags precies één keer
      if ($("title").length !== 1 || $("head title").length !== 1) err(p, `${$("title").length}× <title>`);
      const title = $("head title").first().text().trim();
      const desc = ($('meta[name="description"]').attr("content") ?? "").trim();
      if (!title) err(p, "geen title");
      else {
        if (title.length < 45 || title.length > 60) warn(p, `title ${title.length} tekens (advies 45–60): ${title}`);
        if (!title.endsWith(`| ${BRAND}`)) warn(p, `title eindigt niet op "| ${BRAND}": ${title}`);
        if (titles.has(title)) err(p, `dubbele title (ook op ${titles.get(title)}): ${title}`);
        else titles.set(title, p);
      }
      if (!desc) err(p, "geen meta description");
      else {
        if (desc.length < 140 || desc.length > 160) warn(p, `description ${desc.length} tekens (advies 140–160)`);
        if (descriptions.has(desc)) err(p, `dubbele description (ook op ${descriptions.get(desc)})`);
        else descriptions.set(desc, p);
      }
      const metaCount = new Map();
      $("meta").each((_, m) => {
        const key = $(m).attr("name") ? `name=${$(m).attr("name")}` : $(m).attr("property") ? `property=${$(m).attr("property")}` : $(m).attr("charset") ? "charset" : $(m).attr("http-equiv") ? `http-equiv=${$(m).attr("http-equiv")}` : null;
        if (key) metaCount.set(key, (metaCount.get(key) ?? 0) + 1);
      });
      for (const [key, n] of metaCount) if (n > 1) err(p, `meta-tag ${key} staat ${n}× op de pagina`);
      for (const need of ["name=description", "name=robots", "name=viewport", "charset"]) if (!metaCount.has(need)) err(p, `meta-tag ${need} ontbreekt`);
      if ($("body meta[name], body meta[property], body title, body link[rel='canonical']").length) err(p, "meta-tags staan in <body> in plaats van <head> (gestreamde metadata)");

      // canonical
      const canon = $('link[rel="canonical"]');
      const canonHref = canon.attr("href") ?? "";
      if (canon.length !== 1) err(p, `${canon.length} canonicals`);
      else {
        if (!canonHref.startsWith("https://www.")) err(p, `canonical is niet absoluut met https en www: ${canonHref}`);
        if (!canonHref.endsWith("/")) err(p, `canonical zonder slash aan het eind: ${canonHref}`);
        if (canonHref !== inSitemap.get(p).loc) err(p, `canonical ${canonHref} ≠ sitemap-URL ${inSitemap.get(p).loc}`);
      }
      if ($('link[rel="alternate"][hreflang]').length) warn(p, "hreflang-tags op een eentalige site");

      // Open Graph + Twitter
      const og = (prop) => $(`meta[property="${prop}"]`).attr("content") ?? "";
      for (const prop of ["og:title", "og:description", "og:url", "og:image", "og:image:width", "og:image:height", "og:type", "og:locale"]) {
        const n = $(`meta[property="${prop}"]`).length;
        if (n !== 1) err(p, `${n}× ${prop}`);
        else if (!og(prop).trim()) err(p, `${prop} is leeg`);
      }
      if (og("og:url") && og("og:url") !== canonHref) err(p, `og:url ${og("og:url")} ≠ canonical`);
      if (og("og:image:width") !== "1200" || og("og:image:height") !== "630") err(p, `og:image is niet 1200×630 (${og("og:image:width")}×${og("og:image:height")})`);
      if (og("og:locale") && og("og:locale") !== "nl_NL") err(p, `og:locale ${og("og:locale")} (verwacht nl_NL)`);
      const wantType = kind === "blog" && p !== "/blog/" ? "article" : "website";
      if (og("og:type") && og("og:type") !== wantType) warn(p, `og:type ${og("og:type")} (verwacht ${wantType})`);
      if (og("og:image")) {
        if (!og("og:image").startsWith(`${SITE}/`)) err(p, `og:image is geen absolute URL op ${SITE}: ${og("og:image")}`);
        else if (!ogImages.has(og("og:image").slice(SITE.length))) ogImages.set(og("og:image").slice(SITE.length), p);
      }
      if ($('meta[name="twitter:card"]').attr("content") !== "summary_large_image") err(p, "twitter:card ontbreekt of is niet summary_large_image");
      for (const name of ["twitter:title", "twitter:description", "twitter:image"]) if (!$(`meta[name="${name}"]`).attr("content")) err(p, `${name} ontbreekt`);

      // structured data
      const nodes = jsonLd($, p);
      const has = (t) => ofType(nodes, t).length > 0;
      if (!has("Organization") || !has("WebSite")) err(p, "Organization/WebSite ontbreekt in JSON-LD");
      for (const t of ["Organization", "WebSite", "BreadcrumbList", "Product", "FAQPage", "BlogPosting"]) if (ofType(nodes, t).length > 1) err(p, `${ofType(nodes, t).length}× ${t} in JSON-LD`);
      if (p === "/") {
        if (has("BreadcrumbList")) warn(p, "BreadcrumbList op de homepage");
      } else {
        const bc = ofType(nodes, "BreadcrumbList")[0];
        if (!bc) err(p, "BreadcrumbList ontbreekt");
        else {
          const items = [].concat(bc.itemListElement ?? []);
          const last = items[items.length - 1];
          if (items.length < 2) err(p, "BreadcrumbList met minder dan 2 items");
          if (last && (last.item?.["@id"] ?? last.item) !== `${SITE}${p}`) err(p, `laatste item van BreadcrumbList (${last.item?.["@id"] ?? last.item}) is niet de pagina zelf`);
          for (const it of items) if (typeof (it.item?.["@id"] ?? it.item) !== "string" || !(it.item?.["@id"] ?? it.item).startsWith(`${SITE}/`) || !it.name) err(p, "BreadcrumbList-item zonder naam of absolute URL");
        }
        if (!$('nav[aria-label="Kruimelpad"] ol li').length) err(p, "zichtbaar kruimelpad ontbreekt");
      }
      const product = ofType(nodes, "Product")[0];
      const visibleReviews = $("#reviews article").length;
      if (kind === "producten") {
        if (!product) err(p, "Product ontbreekt in JSON-LD");
        else {
          const offers = [].concat(product.offers ?? []);
          if (!offers.length) err(p, "Product zonder Offer");
          for (const o of offers) {
            const price = o.price ?? o.lowPrice;
            if (price === undefined || price === "" || Number.isNaN(Number(price)) || Number(price) <= 0) err(p, `Offer zonder geldige prijs (${price})`);
            if (o.priceCurrency !== "EUR") err(p, `Offer priceCurrency ${o.priceCurrency} (verwacht EUR)`);
            if (!/^https:\/\/schema\.org\/(InStock|OutOfStock|PreOrder|BackOrder|LimitedAvailability|SoldOut|Discontinued)$/.test(o.availability ?? "")) err(p, `Offer zonder geldige availability (${o.availability})`);
          }
          if (!product.name) err(p, "Product zonder name");
          if (!product.image) warn(p, "Product zonder image in JSON-LD");
          if (product.aggregateRating && !visibleReviews) err(p, "aggregateRating zonder zichtbare reviews op de pagina");
          if (!product.aggregateRating && visibleReviews) warn(p, `${visibleReviews} zichtbare reviews maar geen aggregateRating`);
          if (product.aggregateRating && !(Number(product.aggregateRating.reviewCount ?? product.aggregateRating.ratingCount) > 0)) err(p, "aggregateRating zonder reviewCount");
          if (product.review && !visibleReviews) err(p, "review in JSON-LD zonder zichtbare reviews");
        }
        if (!/€\s?\d/.test(mainText)) err(p, "geen prijs in de HTML-bron van de productpagina");
      } else {
        if (product) err(p, "Product in JSON-LD op een pagina die geen productpagina is");
        for (const n of nodes) if (n?.aggregateRating && !$("main article").length) err(p, `aggregateRating (${[].concat(n["@type"]).join("/")}) zonder zichtbare reviews`);
      }
      const wantsList = kind === "categorieen" || p === "/blog/";
      if (wantsList) {
        const list = ofType(nodes, "ItemList")[0];
        if (!list) (p === "/merken/" ? warn : err)(p, "ItemList ontbreekt in JSON-LD");
        else if (![].concat(list.itemListElement ?? []).length) warn(p, "ItemList zonder items (lege lijst)");
        if (kind === "categorieen" && p !== "/merken/" && list && [].concat(list.itemListElement ?? []).length && !/€\s?\d/.test(mainText)) err(p, "geen prijzen in de HTML-bron van de productlijst");
      }
      if (kind === "blog" && p !== "/blog/") {
        const post = ofType(nodes, "BlogPosting")[0];
        if (!post) err(p, "BlogPosting ontbreekt in JSON-LD");
        else for (const f of ["headline", "datePublished", "dateModified", "author", "image"]) if (!post[f]) (f === "image" ? warn : err)(p, `BlogPosting zonder ${f}`);
      } else if (has("BlogPosting") || has("Article")) err(p, "BlogPosting/Article op een pagina die geen artikel is");
      if (has("FAQPage")) {
        if (faqPath && faqPath !== p) err(p, `FAQPage staat ook op ${faqPath}: alleen op de FAQ-pagina`);
        if (!/veelgestelde-vragen|faq/.test(p)) err(p, "FAQPage op een pagina die niet de FAQ-pagina is");
        faqPath ??= p;
        const pageText = $("body").text().replace(/\s+/g, " ");
        const qs = [].concat(ofType(nodes, "FAQPage")[0].mainEntity ?? []);
        if (!qs.length) err(p, "FAQPage zonder vragen");
        const missing = qs.filter((q) => !pageText.includes(String(q.name ?? "").replace(/\s+/g, " ").trim()));
        if (missing.length) err(p, `FAQPage: ${missing.length} vraag/vragen staan niet zichtbaar op de pagina (bv. "${missing[0].name}")`);
      } else if (/veelgestelde-vragen|\/faq\//.test(p)) err(p, "FAQPage ontbreekt op de FAQ-pagina");

      // afbeeldingen
      let mainImgIndex = 0;
      const eager = [];
      $("img").each((_, img) => {
        const src = $(img).attr("src") ?? $(img).attr("srcset") ?? "";
        const short = src.length > 90 ? `${src.slice(0, 90)}…` : src;
        if ($(img).attr("alt") === undefined) err(p, `afbeelding zonder alt: ${short}`);
        if (!$(img).attr("width") || !$(img).attr("height")) err(p, `afbeelding zonder width/height: ${short}`);
        const inMain = $(img).closest("main").length > 0;
        const inHeader = $(img).closest("header").length > 0;
        if (inMain) mainImgIndex++;
        // boven de vouw: afbeeldingen in de header en de eerste vier in <main> (hero of de eerste rij productkaarten)
        if ($(img).attr("loading") !== "lazy" && !inHeader && !(inMain && mainImgIndex <= 4)) eager.push(short);
      });
      if (eager.length) warn(p, `${eager.length} afbeelding(en) onder de vouw zonder loading="lazy" (bv. ${eager[0]})`);

      // placeholders
      const visibleSource = r.text.replace(/<script(?![^>]*application\/ld\+json)[^>]*>.*?<\/script>/gs, "");
      for (const re of PLACEHOLDERS) {
        const m = re.exec(visibleSource);
        if (m) err(p, `voorbeeldwaarde gevonden: "${m[0]}" (…${visibleSource.slice(Math.max(0, m.index - 40), m.index + 50).replace(/\s+/g, " ")}…)`);
      }

      info.set(p, { url: p, kind, title: title.length, description: desc.length, words: wordCount, h1: h1.first().text().replace(/\s+/g, " ").trim() });
    }

    while (queue.length) {
      const batch = queue.splice(0, queue.length);
      await pool(batch, 8, check);
      process.stdout.write(`\r[seo] ${pages.size} URL's opgehaald…`);
    }
    console.log();
    report.crawled = pages.size;

    // og:image: 200, een afbeelding, 1200×630
    let sharp = null;
    try {
      sharp = (await import("sharp")).default;
    } catch {
      /* zonder sharp alleen status en type */
    }
    await pool([...ogImages], 6, async ([img, from]) => {
      const r = await get(img, { binary: true });
      if (r.status !== 200) return err(from, `og:image ${img} geeft status ${r.status}`);
      if (!/^image\/(jpeg|png|webp)/.test(r.type)) return err(from, `og:image ${img} is geen afbeelding (${r.type})`);
      if (sharp) {
        try {
          const meta = await sharp(r.body).metadata();
          if (meta.width !== 1200 || meta.height !== 630) err(from, `og:image ${img} is ${meta.width}×${meta.height} in plaats van 1200×630`);
        } catch {
          err(from, `og:image ${img} is geen leesbare afbeelding`);
        }
      }
    });
    console.log(`[seo] ${ogImages.size} og:images gecontroleerd`);

    // interne links naar een 404 of een redirect
    const disallowed = (u) => ROBOTS_DISALLOW.some((d) => u.startsWith(d));
    for (const [target, from] of linkedFrom) {
      const st = pages.get(target);
      if (!st || st.status === 200) continue;
      const msg = `interne link naar ${target} geeft status ${st.status}${st.location ? ` → ${localPath(st.location) ?? st.location}` : ""} (op ${from.size} pagina's)`;
      // Afgeschermde pagina's (account, afrekenen) mogen naar de inlogpagina of de winkelwagen doorsturen.
      if (disallowed(target) && st.status >= 300 && st.status < 400) warn([...from][0], msg);
      else err([...from][0], msg);
    }

    // inkomende links (aantal verschillende pagina's) en klikdiepte vanaf home
    const inbound = new Map();
    for (const [from, targets] of outLinks) {
      const src = from.split("?")[0];
      for (const t of targets) {
        if (t === src) continue;
        if (!inbound.has(t)) inbound.set(t, new Set());
        inbound.get(t).add(from);
      }
    }
    const depth = new Map([["/", 0]]);
    let frontier = ["/"];
    while (frontier.length) {
      const next = [];
      for (const from of frontier) {
        for (const t of outLinks.get(from) ?? []) {
          // een gepagineerde lijst (?pagina=N) is een eigen stap: lijst → pagina N → product
          for (const node of [t, ...[...outLinks.keys()].filter((k) => k.startsWith(`${t}?pagina=`) && linkedFrom.get(k)?.has(from))]) {
            if (depth.has(node)) continue;
            depth.set(node, depth.get(from) + 1);
            next.push(node);
          }
        }
      }
      frontier = next;
    }
    for (const p of inSitemap.keys()) {
      const n = inbound.get(p)?.size ?? 0;
      const d = depth.get(p);
      if (info.has(p)) Object.assign(info.get(p), { inlinks: n, depth: d ?? null });
      if (p === "/") continue;
      if (n === 0) err(p, "weespagina: geen enkele interne link");
      else if (n < MIN_INLINKS) err(p, `slechts ${n} inkomende interne link(s) (minimaal ${MIN_INLINKS}): ${[...inbound.get(p)].join(", ")}`);
      if (d === undefined) err(p, "niet bereikbaar via links vanaf de homepage");
      else if (d > MAX_DEPTH) err(p, `${d} klikken vanaf de homepage (maximaal ${MAX_DEPTH})`);
    }

    // ---------- noindex, filters, paginering, 404 ----------
    const page = async (u, opts) => {
      const r = await follow(u, opts);
      const $ = cheerio.load(r.final?.text ?? "");
      return { ...r, $, robots: robotsOf($), canonical: $('link[rel="canonical"]').attr("href") ?? null, title: $("title").first().text().trim() };
    };
    for (const u of NOINDEX_PATHS) {
      const r = await page(u);
      if (!r.final || r.final.status !== 200) err(u, `verwacht een 200-pagina met noindex, kreeg ${r.chain.map((c) => c.status).join(" → ")}`);
      else if (!/noindex/.test(r.robots) && !/noindex/i.test(r.final.xRobots)) err(u, `geen noindex (meta robots "${r.robots}"${r.finalPath !== u ? `, na redirect naar ${r.finalPath}` : ""})`);
      if (inSitemap.has(u.split("?")[0])) err(u, "noindex-pagina staat in de sitemap");
    }
    for (const d of ROBOTS_DISALLOW) for (const p of inSitemap.keys()) if (p.startsWith(d)) err(p, `staat in de sitemap maar is geblokkeerd in robots.txt (${d})`);

    const nf = await get("/deze-pagina-bestaat-echt-niet/");
    if (nf.status !== 404) err("/deze-pagina-bestaat-echt-niet/", `niet-bestaande URL geeft status ${nf.status} in plaats van 404`);
    if (!/noindex/.test(robotsOf(cheerio.load(nf.text)))) err("/deze-pagina-bestaat-echt-niet/", "404-pagina zonder noindex");
    if (cheerio.load(nf.text)('link[rel="canonical"]').length) err("/deze-pagina-bestaat-echt-niet/", "404-pagina met canonical");
    for (const u of ["/producten/dit-product-bestaat-niet/", "/merken/dit-merk-bestaat-niet/", "/blog/dit-artikel-bestaat-niet/"]) {
      const r = await get(u);
      if (r.status !== 404) err(u, `niet-bestaande URL geeft status ${r.status} in plaats van 404`);
    }

    // gefilterde/gesorteerde lijst: noindex,follow + canonical naar de schone URL
    const listPaths = [...inSitemap].filter(([, v]) => v.kind === "categorieen").map(([p]) => p);
    const withPages = [...pages.keys()].filter((u) => /\?pagina=2$/.test(u) && pages.get(u).status === 200).map((u) => u.split("?")[0]);
    const category = withPages.find((p) => !p.startsWith("/merken/")) ?? listPaths.find((p) => !p.startsWith("/merken/"));
    const brandPath = listPaths.find((p) => /^\/merken\/[^/]+\/$/.test(p));
    const brandSlug = brandPath?.split("/")[2];
    const filterTests = [];
    if (category) filterTests.push([category, "?sorteer=prijs-oplopend"], ...(brandSlug ? [[category, `?merk=${brandSlug}`]] : []), [category, "?voorraad=1"]);
    if (brandPath) filterTests.push([brandPath, "?sorteer=prijs-oplopend"]);
    if (!filterTests.length) err("/sitemap-categorieen.xml", "geen categorie of merk gevonden om filters te testen");
    for (const [base, qs] of filterTests) {
      const r = await page(base + qs);
      if (r.final?.status !== 200 || r.finalPath !== base + qs) {
        err(base + qs, `gefilterde URL geeft ${r.chain.map((c) => c.status).join(" → ")}`);
        continue;
      }
      if (!/noindex/.test(r.robots) || /nofollow/.test(r.robots)) err(base + qs, `gefilterde/gesorteerde URL moet noindex,follow zijn (is "${r.robots}")`);
      if (r.canonical !== `${SITE}${base}`) err(base + qs, `canonical ${r.canonical} ≠ schone URL ${SITE}${base}`);
    }
    // paginering
    if (!withPages.length) warn("/sitemap-categorieen.xml", "geen lijst met een tweede pagina gevonden: paginering niet getest");
    for (const base of [withPages.find((p) => !p.startsWith("/merken/")), withPages.find((p) => p.startsWith("/merken/"))].filter(Boolean)) {
      const r = await page(`${base}?pagina=2`);
      if (!/\bindex\b/.test(r.robots.replace(/noindex/g, ""))) err(`${base}?pagina=2`, `gepagineerde URL moet indexeerbaar zijn (is "${r.robots}")`);
      if (r.canonical !== `${SITE}${base}?pagina=2`) err(`${base}?pagina=2`, `canonical ${r.canonical} ≠ ${SITE}${base}?pagina=2`);
      if (!/pagina 2/i.test(r.title)) err(`${base}?pagina=2`, `geen paginanummer in de title: ${r.title}`);
      if (r.$("h1").length !== 1) err(`${base}?pagina=2`, `${r.$("h1").length} H1's`);
      const one = await follow(`${base}?pagina=1`);
      if (one.chain.length !== 2 || ![301, 308].includes(one.chain[0].status) || one.finalPath !== base || one.final?.status !== 200) err(`${base}?pagina=1`, `verwacht één permanente redirect naar ${base}, kreeg ${one.chain.map((c) => `${c.status}${c.location ? ` → ${c.location}` : ""}`).join(", ")}`);
      const sorted = await page(`${base}?sorteer=prijs-oplopend&pagina=2`);
      if (sorted.final?.status === 200 && (!/noindex/.test(sorted.robots) || sorted.canonical !== `${SITE}${base}?pagina=2`)) err(`${base}?sorteer=prijs-oplopend&pagina=2`, `gesorteerd + gepagineerd: verwacht noindex met canonical naar ${base}?pagina=2 (is "${sorted.robots}", ${sorted.canonical})`);
    }
    for (const base of [category, brandPath].filter(Boolean)) {
      for (const qs of ["?pagina=999", "?pagina=0", "?pagina=abc"]) {
        const r = await get(base + qs);
        if (r.status !== 404) err(base + qs, `niet-bestaande pagina geeft status ${r.status} in plaats van 404`);
      }
    }

    // ---------- redirects ----------
    const samples = [...inSitemap.keys()].filter((p) => p !== "/");
    for (const p of [samples.find((x) => inSitemap.get(x).kind === "paginas"), samples.find((x) => inSitemap.get(x).kind === "producten"), samples.find((x) => inSitemap.get(x).kind === "categorieen"), samples.find((x) => inSitemap.get(x).kind === "blog")].filter(Boolean)) {
      const noSlash = p.replace(/\/$/, "");
      const r = await follow(noSlash);
      if (r.chain.length !== 2 || r.chain[0].status !== 301 || r.finalPath !== p || r.final?.status !== 200) err(noSlash, `URL zonder slash: verwacht één 301 naar ${p}, kreeg ${r.chain.map((c) => `${c.status}${c.location ? ` → ${c.location}` : ""}`).join(", ")}`);
      const upper = await follow(`${noSlash}?utm_source=test`);
      if (upper.chain[0].status !== 301 || upper.finalPath !== `${p}?utm_source=test`) err(`${noSlash}?utm_source=test`, `querystring gaat verloren bij de redirect naar de slash (${upper.finalPath})`);
    }
    for (const old of OLD_URLS) {
      const r = await follow(old);
      const steps = r.chain.map((c) => `${c.status}${c.location ? ` → ${localPath(c.location) ?? c.location}` : ""}`).join(", ");
      if (r.chain[0].status !== 301) err(old, `oude Shopify-URL: verwacht 301, kreeg ${steps}`);
      else if (r.chain.length !== 2 || r.final?.status !== 200) err(old, `oude Shopify-URL: verwacht 301 → 200 in één stap, kreeg ${steps}`);
      else if (!inSitemap.has(r.finalPath.split("?")[0])) warn(old, `oude Shopify-URL verwijst naar ${r.finalPath}, die niet in de sitemap staat`);
    }

    // ---------- X-Robots-Tag ----------
    const adminLogin = await get("/admin/login/");
    if (!/noindex/i.test(adminLogin.xRobots)) err("/admin/login/", `X-Robots-Tag noindex ontbreekt op /admin/ (is "${adminLogin.xRobots}")`);
    const adminRoot = await get("/admin/");
    if (adminRoot.status === 200 && !/noindex/i.test(adminRoot.xRobots)) err("/admin/", "X-Robots-Tag noindex ontbreekt");
    for (const p of ["/", samples.find((x) => inSitemap.get(x).kind === "producten")].filter(Boolean)) {
      const preview = await get(p, { host: PREVIEW_HOST });
      if (!/noindex/i.test(preview.xRobots)) err(p, `X-Robots-Tag noindex ontbreekt bij Host: ${PREVIEW_HOST} (status ${preview.status}, is "${preview.xRobots}")`);
      const prod = await get(p);
      if (prod.status !== 200) err(p, `Host: ${SITE_HOST} + x-forwarded-proto https geeft status ${prod.status}${prod.location ? ` → ${prod.location}` : ""}`);
      if (/noindex/i.test(prod.xRobots)) err(p, `X-Robots-Tag noindex bij Host: ${SITE_HOST}`);
    }
    for (const f of ["/sitemap.xml", "/robots.txt"]) {
      const r = await get(f);
      if (/noindex/i.test(r.xRobots)) warn(f, `X-Robots-Tag "${r.xRobots}" bij Host: ${SITE_HOST}`);
    }

    report.pages = [...info.values()].sort((a, b) => a.url.localeCompare(b.url));
  } finally {
    if (server) {
      server.child.kill();
      await new Promise((r) => setTimeout(r, 300));
    }
    for (const a of Object.values(agents)) a.destroy();
  }

  report.thin.sort((a, b) => a.words - b.words);
  const kinds = (list) => {
    const counts = {};
    for (const line of list) {
      const key = line
        .slice(line.indexOf("  ") + 2)
        .replace(/\d+/g, "N")
        .replace(/[:(].*$/, "")
        .trim()
        .slice(0, 70);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
  };
  report.summary = { urls: report.urls, crawled: report.crawled, errors: errors.length, warnings: warnings.length, errorKinds: kinds(errors), warningKinds: kinds(warnings) };
  fs.writeFileSync(path.join(root, "seo-report.json"), JSON.stringify(report, null, 2));
  console.log(`\n[seo] ${report.urls} sitemap-URL's · ${report.crawled} URL's opgehaald · fouten: ${errors.length} · waarschuwingen: ${warnings.length} (zie seo-report.json)`);
  for (const [k, n] of Object.entries(report.summary.errorKinds).slice(0, 25)) console.log(`  ✗ ${n}× ${k}`);
  for (const e of errors.slice(0, 40)) console.log(`  ✗ ${e}`);
  if (errors.length > 40) console.log(`  … en nog ${errors.length - 40}`);
  for (const [k, n] of Object.entries(report.summary.warningKinds).slice(0, 15)) console.log(`  ! ${n}× ${k}`);
  process.exitCode = errors.length ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
