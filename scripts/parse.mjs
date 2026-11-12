// Zet de ruwe scrape van www.bluepuremarine.com (scripts/raw/html/: Shopify-feeds + afgeslankte HTML) om naar
// content/*.json: producten, categorieën, merken, pagina's, veelgestelde vragen, reviews, redirects en afbeeldingen.
// De seed (prisma/seed.ts) leest alleen deze JSON-bestanden. Gebruik: npm run scrape:parse
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const raw = path.join(root, "scripts", "raw", "html");
const out = path.join(root, "content");
fs.mkdirSync(out, { recursive: true });

const readJson = (f) => JSON.parse(fs.readFileSync(path.join(raw, f), "utf8"));
const load = (f) => cheerio.load(fs.readFileSync(path.join(raw, f), "utf8"));
const exists = (f) => fs.existsSync(path.join(raw, f));
const write = (name, data) => fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify(data, null, 2) + "\n");
const warnings = [];
const warn = (m) => warnings.push(m);

const BRAND = "BluePure Marine";
const SUFFIX = ` | ${BRAND}`;
const CDN = "https://cdn.shopify.com/s/files/1/1071/6325/5116";
const text = (s) => (s ?? "").replace(/ /g, " ").replace(/\s+/g, " ").trim();
const cents = (v) => (v == null || v === "" ? null : Math.round(parseFloat(String(v)) * 100));
const slugify = (s) =>
  String(s)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " en ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
/** Productslug = oude handle zonder tekens buiten a-z0-9- */
const productSlug = (handle) => handle.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/-{2,}/g, "-").replace(/^-|-$/g, "");
/** Bestandsnaam van de afgeslankte HTML (tekens buiten a-z0-9- zijn daar een underscore) */
const htmlName = (prefix, handle) => `${prefix}-${handle.replace(/[^a-z0-9-]/g, "_")}.html`;

// ---------------------------------------------------------------------------------------------------------------
// Categorieboom (CONTRACT.md). `source` = handle van de oude Shopify-collectie. Inleiding en meta zijn geschreven op
// basis van de producten die echt in de collectie zitten; de oude site had alleen bij de drie pakketten een tekst.
// ---------------------------------------------------------------------------------------------------------------
const TREE = [
  {
    path: "/onderhoud/", name: "Onderhoud & reiniging", navTitle: "Onderhoud",
    intro: "Reinigers, onderhoudsmiddelen en accessoires voor de buitenkant en het interieur van je boot, uit de eigen reinigingslijn van BluePure Marine.",
    metaTitle: "Onderhoud & reiniging voor je boot",
    metaDescription: "Reinigers en onderhoudsmiddelen voor romp, dek, kajuit en schroef van je boot, met borstels en doeken uit de eigen lijn van BluePure Marine. Bekijk het aanbod.",
    children: [
      { slug: "exterieur", name: "Exterieur", source: "exterieur", group: "Per plek aan boord",
        intro: "Alles voor de buitenkant van je boot: reinigers voor romp, dek, ramen en schroef, plus een steelborstel en een droogdoek.",
        metaTitle: "Bootreinigers voor het exterieur",
        metaDescription: "Reinig de buitenkant van je boot met de Exterior cleaner, Exterior + cleaner, Propeller cleaner en Glass cleaner. Met bijpassende steelborstel en droogdoek." },
      { slug: "interieur", name: "Interieur", source: "interieur", group: "Per plek aan boord",
        intro: "Reinigers voor kajuit, bilge en motorruimte: van interieurreiniger en schimmelverwijderaar tot ontvetter en desinfectie, met microvezeldoeken en een handborstel.",
        metaTitle: "Bootreinigers voor het interieur",
        metaDescription: "Reinigers voor het interieur van je boot: Interior cleaner, Mold remover, Oil remover, Glass cleaner en Desinfectie, met microvezeldoeken en een handborstel." },
      { slug: "reinigingsproducten", name: "Reinigingsproducten", source: "onderhoudsmiddelen", group: "Producten",
        intro: "De complete reinigingslijn van BluePure Marine: reinigers voor romp, dek, interieur, glas en schroef.",
        metaTitle: "Reinigingsproducten voor je boot",
        metaDescription: "Alle reinigingsproducten van BluePure Marine: Exterior cleaner, Interior cleaner, Mold remover, Oil remover, Propeller cleaner, Glass cleaner en Desinfectie." },
      { slug: "onderhoudsmiddelen", name: "Onderhoud", source: "onderhoud", group: "Producten",
        intro: "Vier basisreinigers voor regelmatig onderhoud van je boot: voor de buitenkant, het interieur, olie en vet, en de schroef.",
        metaTitle: "Onderhoudsmiddelen voor je boot",
        metaDescription: "Onderhoudsmiddelen voor regelmatig bootonderhoud: de Exterior cleaner, Interior cleaner, Oil remover en Propeller cleaner uit de lijn van BluePure Marine." },
      { slug: "accessoires", name: "Accessoires", source: "accessoires", group: "Producten",
        intro: "Borstels en doeken bij de reinigers: steelborstel, handborstel, droogdoek en microvezeldoeken.",
        metaTitle: "Schoonmaakaccessoires voor je boot",
        metaDescription: "Accessoires bij de reinigers van BluePure Marine: de scrubbing brush met steel, de hand brush, de dry towel en een set van vijf microvezeldoeken voor je boot." },
    ],
  },
  {
    path: "/bootonderdelen/", name: "Bootonderdelen",
    intro: "Onderdelen voor aan dek en voor de aandrijving: ankers en lieren, blokken, biminis, boegschroeven, motorbedieningen en waterpompen.",
    metaTitle: "Bootonderdelen online bestellen",
    metaDescription: "Bootonderdelen van merken als Harken, Lewmar, Vetus, Quick en Mercury: ankers, blokken, biminis, boegschroeven, motorbedieningen en waterpompen voor je boot.",
    children: [
      { slug: "ankers-en-lieren", name: "Ankers en lieren", source: "ankers-en-lieren", group: "Aan dek",
        intro: "Ankers van roestvast en gegalvaniseerd staal en een elektrische ankerlier van Maxwell.",
        metaTitle: "Ankers en ankerlieren voor je boot",
        metaDescription: "Ankers en lieren voor je boot: een poolanker en Bruce-anker van 20 kg in RVS 316, een Danforth-anker van 8 kg en de elektrische Maxwell HRC8-ankerlier (24 V)." },
      { slug: "blokken", name: "Blokken", source: "blokken", group: "Aan dek",
        intro: "Blokken, genuasledes, eindblokken en een overloopwagen van Harken, Lewmar en Antal voor schoot- en trimlijnen.",
        metaTitle: "Blokken en genuasledes voor zeilboten",
        metaDescription: "Blokken voor je zeilboot van Harken, Lewmar en Antal: drievoudige blokken, voetblokken, genuasledes, eindblokken en een kogelgelagerde overloopwagen." },
      { slug: "biminis", name: "Biminis", source: "biminis", group: "Aan dek",
        intro: "Opblaasbare biminis van Decktent in de maten XS tot en met L, in wit en zwart.",
        metaTitle: "Opblaasbare biminis van Decktent",
        metaDescription: "Opblaasbare biminis van Decktent als zonwering voor je boot, verkrijgbaar in de maten XS, S, S+, M en L, in wit en zwart. Bekijk alle zeven uitvoeringen." },
      { slug: "boegschroeven", name: "Boegschroeven", source: "boegschroeven", group: "Aandrijving & systemen",
        intro: "Boegschroeven van 25 tot 65 kgf voor tunnels van 110 tot 185 mm, plus een vervangende 12 V-motor van Vetus.",
        metaTitle: "Boegschroeven 12 V voor je boot",
        metaDescription: "Boegschroeven voor je boot: de Quick BTQ 110 en BTQ 125 en bow thrusters van 35, 55 en 65 kgf voor tunnels van 110 tot 185 mm. Ook de Vetus SET0159-motor." },
      { slug: "motorbedieningen", name: "Motorbedieningen", source: "gashendels", group: "Aandrijving & systemen",
        intro: "Motorbedieningen en joystickpanelen van Mercury, Volvo Penta, Vetus, Ultraflex en Side-Power.",
        metaTitle: "Motorbedieningen en gashendels",
        metaDescription: "Motorbedieningen voor je boot: gashendels en elektronische bedieningen van Mercury, Volvo Penta, Vetus en Ultraflex, plus joystickpanelen voor de boegschroef." },
      { slug: "waterpompen", name: "Waterpompen", source: "pompen", group: "Aandrijving & systemen",
        intro: "Automatische drinkwaterpompen van Jabsco en Johnson Pump met een opbrengst van 9 tot 11 liter per minuut.",
        metaTitle: "Drinkwaterpompen voor aan boord",
        metaDescription: "Waterpompen voor het drinkwatersysteem aan boord: de Jabsco Par-Max 3 en de Johnson Pump Aqua Jet WPS 2.4 en WPS 2.9, met 9 tot 11 liter per minuut." },
    ],
  },
  {
    path: "/navigatie-elektronica/", name: "Navigatie & elektronica", source: "navigatie-en-elektronica",
    intro: "Kaartplotters, GPS-navigators, instrumenten, antennes, bedieningspanelen en kabels van onder meer Garmin, Furuno, Navico en Sailor.",
    metaTitle: "Navigatie & elektronica voor je boot",
    metaDescription: "Navigatie en elektronica voor aan boord: kaartplotters, GPS-navigators, instrumenten, antennes en kabels van Garmin, Furuno, Navico, Sailor en Volvo Penta.",
    children: [],
  },
  {
    path: "/watersport/", name: "Watersport",
    intro: "Opblaasbare platforms, water lounges, SUP-boards, hondenloopplanken en opblaasboten voor op en rond het water.",
    metaTitle: "Watersportartikelen voor bij je boot",
    metaDescription: "Watersportartikelen voor bij je boot: opblaasbare platforms, water lounges, SUP-boards en hondenloopplanken van Decktent en opblaasboten met transparante bodem.",
    children: [
      { slug: "accessoires", name: "Watersport & accessoires", navTitle: "Accessoires", source: "watersport-accessoires", group: "",
        intro: "Opblaasbare platforms, water lounges, SUP-boards en hondenloopplanken van Decktent, en solar relingverlichting van Ecstasea.",
        metaTitle: "Watersport & accessoires van Decktent",
        metaDescription: "Watersportaccessoires voor bij je boot: opblaasbare platforms, water lounges, SUP-boards met houtlook en dog ramps van Decktent en solar relingverlichting." },
      { slug: "boten", name: "Boten", source: "boten-1", group: "",
        intro: "De Formentera opblaasboot met transparante bodem, in drie maten.",
        metaTitle: "Opblaasboten met transparante bodem",
        metaDescription: "Formentera opblaasboten met transparante bodem, verkrijgbaar in de maten M, L en XL. Bekijk de specificaties en bestel je opblaasboot bij BluePure Marine." },
    ],
  },
  {
    path: "/pakketten/", name: "Pakketten & deals", navTitle: "Pakketten & deals", highlight: true,
    intro: "Grootverpakkingen en samengestelde sets van de BluePure-reinigers: 5 liter-verpakkingen en pakketten voor interieur en exterieur.",
    metaTitle: "Pakketten & deals met bootreinigers",
    metaDescription: "Pakketten en deals van BluePure Marine: reinigers in 5 liter-verpakking en samengestelde sets voor de buitenkant, het interieur en de schroef van je boot.",
    children: [
      { slug: "5-liter-deals", name: "5 liter deals", source: "5-liters-deal", group: "",
        intro: "De reinigers van BluePure Marine in grootverpakking van 5 liter.",
        metaTitle: "5 liter deals op bootreinigers",
        metaDescription: "De reinigers van BluePure Marine in grootverpakking van 5 liter: Exterior cleaner, Exterior + cleaner, Interior cleaner, Oil remover en Propeller cleaner." },
      { slug: "alles-in-1-pakket", name: "Alles in 1 pakket", source: "alles-in-1-pakket", group: "",
        intro: "Drie reinigers in één pakket: Exterior + cleaner, Interior cleaner en Oil remover.",
        metaTitle: "Alles in 1 pakket: drie bootreinigers",
        metaDescription: "Het Alles in 1 pakket van BluePure Marine combineert de Exterior + cleaner, Interior cleaner en Oil remover voor de reiniging van je hele boot in één set." },
      { slug: "exterior-pakket", name: "Exterior pakket", source: "exterior-pakket", group: "",
        intro: "Drie reinigers voor de buitenkant in één pakket: Propeller cleaner, Exterior cleaner en Exterior + cleaner.",
        metaTitle: "Exterior pakket voor de buitenkant",
        metaDescription: "Het Exterior pakket van BluePure Marine bevat de Propeller cleaner, Exterior cleaner en Exterior + cleaner: een complete set voor de buitenkant van je boot." },
      { slug: "bestrijdingspakket", name: "Bestrijdingspakket", source: "bestrijdingspakket", group: "",
        intro: "Desinfectie, Exterior cleaner en Mold remover in één pakket.",
        metaTitle: "Bestrijdingspakket voor een schone boot",
        metaDescription: "Het Bestrijdingspakket van BluePure Marine: Desinfectie, Exterior cleaner en Mold remover in één set tegen bacteriën, aanslag en schimmel aan boord van je boot." },
    ],
  },
  {
    path: "/bestsellers/", name: "Bestsellers", source: "frontpage",
    intro: "De bestsellers van BluePure Marine: reinigers voor romp, dek, interieur en schroef.",
    metaTitle: "Bestsellers: populaire bootreinigers",
    metaDescription: "De bestsellers van BluePure Marine op een rij: Exterior cleaner, Interior cleaner, Mold remover, Oil remover en Propeller cleaner voor een schone boot.",
    children: [],
  },
];

// Nieuwe paden van de oude pagina's (translationKey → pad) — zie CONTRACT.md
const PAGE_PATHS = {
  contact: { key: "contact", path: "/contact/" },
  klantenservice: { key: "klantenservice", path: "/klantenservice/" },
  "veelgestelde-vragen": { key: "faq", path: "/veelgestelde-vragen/" },
  verzending: { key: "verzending", path: "/verzending/" },
  retourbeleid: { key: "retourbeleid", path: "/retourbeleid/" },
  "hoe-wij-de-bestellingen-en-contact-verwerken": { key: "bestellingen", path: "/hoe-wij-de-bestellingen-en-contact-verwerken/" },
};
const POLICY_PATHS = {
  "privacy-policy": "/privacy/",
  "terms-of-service": "/algemene-voorwaarden/",
  "refund-policy": "/retourbeleid/",
  "shipping-policy": "/verzending/",
  "legal-notice": "/juridische-informatie/",
  "contact-information": "/contact/",
};

// ---------- categorieën plat maken ----------
const categories = [];
const byHandle = new Map(); // oude collectie-handle → categoriepad
TREE.forEach((main, i) => {
  categories.push({ path: main.path, slug: main.path.replace(/\//g, ""), name: main.name, navTitle: main.navTitle ?? "", parentPath: null, menuGroup: "", sourceHandle: main.source ?? null, highlight: !!main.highlight, sortOrder: (i + 1) * 10, intro: main.intro, metaTitle: main.metaTitle + SUFFIX, metaDescription: main.metaDescription });
  if (main.source) byHandle.set(main.source, main.path);
  main.children.forEach((c, k) => {
    const p = `${main.path}${c.slug}/`;
    categories.push({ path: p, slug: c.slug, name: c.name, navTitle: c.navTitle ?? "", parentPath: main.path, menuGroup: c.group ?? "", sourceHandle: c.source, highlight: false, sortOrder: (k + 1) * 10, intro: c.intro, metaTitle: c.metaTitle + SUFFIX, metaDescription: c.metaDescription });
    byHandle.set(c.source, p);
  });
});

// ---------- oude URL → nieuwe URL (voor links in teksten en voor de redirects) ----------
const feedProducts = readJson("feed-products-all.json").products;
const slugOf = new Map(feedProducts.map((p) => [p.handle, productSlug(p.handle)]));
{
  const seen = new Set();
  for (const s of slugOf.values()) {
    if (seen.has(s)) warn(`Dubbele productslug: ${s}`);
    seen.add(s);
  }
}

function newUrl(href) {
  if (!href) return null;
  let h = href.trim().replace(/^(https?:)?\/\/(www\.)?bluepuremarine\.com/i, "");
  if (h === "") h = "/";
  if (/^(mailto:|tel:|https?:\/\/|#)/i.test(h)) return h;
  if (!h.startsWith("/")) return null;
  const [p, hash = ""] = h.split(/(?=#)/);
  const clean = decodeURIComponent(p.split("?")[0]).replace(/\/$/, "");
  let m;
  let to = null;
  if (clean === "") to = "/";
  else if ((m = /^\/products\/(.+)$/.exec(clean))) to = slugOf.has(m[1]) ? `/producten/${slugOf.get(m[1])}/` : null;
  else if (clean === "/collections/all" || clean === "/collections") to = "/bootonderdelen/";
  else if ((m = /^\/collections\/([^/]+)$/.exec(clean))) to = byHandle.get(m[1]) ?? null;
  else if ((m = /^\/pages\/([^/]+)$/.exec(clean))) to = PAGE_PATHS[m[1]]?.path ?? null;
  else if ((m = /^\/policies\/([^/]+)$/.exec(clean))) to = POLICY_PATHS[m[1]] ?? null;
  else if (clean === "/cart") to = "/winkelwagen/";
  else if (clean === "/search") to = "/zoeken/";
  else if (clean === "/account/login") to = "/account/inloggen/";
  else if (clean === "/account/register") to = "/account/registreren/";
  else if (clean === "/account") to = "/account/";
  else if (clean === "/contact") to = "/contact/";
  if (!to) {
    warn(`Onbekende interne link: ${href}`);
    return null;
  }
  return to + hash;
}

// ---------------------------------------------------------------------------------------------------------------
// HTML opschonen: alleen p, h2, h3, ul, ol, li, strong, em, a en tabellen blijven over (geen klassen of stijlen).
// ---------------------------------------------------------------------------------------------------------------
const DROP = new Set(["script", "style", "svg", "button", "img", "iframe", "noscript", "form", "input", "select", "textarea", "picture", "video", "figure", "hr", "meta", "link"]);
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => esc(s).replace(/"/g, "&quot;");
const isBlock = (s) => /^<(p|h2|h3|ul|ol|table)\b/.test(s);
const balanced = (s) => ["strong", "em", "a"].every((t) => (s.match(new RegExp(`<${t}\\b`, "g")) ?? []).length === (s.match(new RegExp(`</${t}>`, "g")) ?? []).length);
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const stripTags = (s) => text(s.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"'));

/** Losse tekst met <br> → één of meer alinea's. */
function paragraphs(inner) {
  const parts = inner.split(/(?:\s*<br>\s*)+/).map((s) => s.trim()).filter((s) => stripTags(s));
  if (!parts.every(balanced)) return stripTags(inner) ? `<p>${inner.replace(/\s*<br>\s*/g, " ").trim()}</p>` : "";
  // korte regels onder elkaar (adres, contactgegevens) blijven één alinea met regeleinden
  if (parts.length > 1 && parts.every((s) => stripTags(s).length <= 70)) return `<p>${parts.join("<br>")}</p>`;
  return parts.map((s) => `<p>${s}</p>`).join("");
}

function cleanHtml(html) {
  if (!html) return "";
  const $ = cheerio.load(`<div id="__root">${html}</div>`, null, false);
  /** Inhoud van een container: losse tekst tussen blokken wordt een alinea. */
  const flow = (node) => {
    let res = "";
    let buf = "";
    const flush = () => {
      res += paragraphs(buf);
      buf = "";
    };
    for (const child of node.children ?? []) {
      const s = walk(child);
      if (isBlock(s)) {
        flush();
        res += s;
      } else buf += s;
    }
    flush();
    return res;
  };
  const inline = (node) => (node.children ?? []).map(walk).join("");
  const walk = (node) => {
    if (node.type === "text") return esc(node.data.replace(/ /g, " ").replace(/\s+/g, " "));
    if (node.type !== "tag") return "";
    const tag = node.name.toLowerCase();
    if (DROP.has(tag)) return "";
    switch (tag) {
      case "br":
        return "<br>";
      case "strong":
      case "b": {
        const k = inline(node);
        return stripTags(k) && !isBlock(k.trim()) ? `<strong>${k}</strong>` : k;
      }
      case "em":
      case "i": {
        const k = inline(node);
        return stripTags(k) && !isBlock(k.trim()) ? `<em>${k}</em>` : k;
      }
      case "span": {
        const k = inline(node);
        // vet gemaakte tekst uit een geplakte bron (klasse Yjhzub) blijft vet
        return /\bYjhzub\b/.test(node.attribs.class ?? "") && stripTags(k) && !isBlock(k.trim()) ? `<strong>${k}</strong>` : k;
      }
      case "a": {
        const k = inline(node);
        const href = newUrl(node.attribs.href);
        return href && stripTags(k) ? `<a href="${escAttr(href)}">${k}</a>` : k;
      }
      case "p":
        return paragraphs(inline(node));
      case "h1":
      case "h2": {
        const t = stripTags(inline(node));
        return t ? `<h2>${esc(capital(t))}</h2>` : "";
      }
      case "h3":
      case "h4":
      case "h5":
      case "h6": {
        const t = stripTags(inline(node));
        return t ? `<h3>${esc(capital(t))}</h3>` : "";
      }
      case "ul":
      case "ol": {
        const items = (node.children ?? []).filter((c) => c.type === "tag" && c.name === "li").map(walk).join("");
        return items ? `<${tag}>${items}</${tag}>` : "";
      }
      case "li": {
        let k = inline(node)
          .replace(/<\/?p>/g, " ")
          .replace(/([^.:!?,;\s])\s*<\/strong>\s*<br>\s*/g, "$1:</strong> ")
          .replace(/\s*<br>\s*/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        return stripTags(k) ? `<li>${k}</li>` : "";
      }
      case "table":
      case "thead":
      case "tbody":
      case "tr": {
        // alleen de elementen: losse witruimte tussen rijen en cellen vervalt
        const k = (node.children ?? []).filter((c) => c.type === "tag").map(walk).join("");
        return k ? `<${tag}>${k}</${tag}>` : "";
      }
      case "th":
      case "td":
        return `<${tag}>${inline(node).replace(/<\/?p>/g, " ").replace(/\s*<br>\s*/g, " ").replace(/\s+/g, " ").trim()}</${tag}>`;
      case "div":
      case "section":
      case "article":
      case "header":
      case "footer":
      case "main":
      case "blockquote":
      case "dl":
      case "dt":
      case "dd":
        return flow(node);
      default:
        return inline(node);
    }
  };
  return flow($("#__root")[0])
    .replace(/<(strong|em)>\s*<\/\1>/g, "")
    .replace(/<\/strong>\s*<strong>/g, " ")
    .replace(/\s+<\/(p|li|h2|h3|td|th)>/g, "</$1>")
    .replace(/<(p|li|td|th)>\s+/g, "<$1>")
    .replace(/<p>\s*<\/p>/g, "")
    .replace(/ {2,}/g, " ")
    .trim();
}

/** Een korte alinea die volledig vet is en niet op een leesteken eindigt, is in de bron een tussenkop. */
const promoteHeadings = (html, tag = "h3") =>
  html
    .replace(/<p><strong>([^<]{3,90})<\/strong><\/p>/g, (m, t) => (/[.!?…]$/.test(t.trim()) ? m : `<${tag}>${capital(t.trim().replace(/:$/, ""))}</${tag}>`))
    // een korte eerste regel zonder leesteken is de titel van de tekst
    .replace(/^<p>([^<]{3,40})<\/p>/, (m, t) => (/[.!?…:]$/.test(t.trim()) ? m : `<${tag}>${capital(t.trim())}</${tag}>`));

// ---------------------------------------------------------------------------------------------------------------
// Productkaarten (korte ondertitel) en reviews staan op meerdere pagina's: eerst alles verzamelen.
// ---------------------------------------------------------------------------------------------------------------
const allHtml = fs.readdirSync(raw).filter((f) => f.endsWith(".html"));
const handleFromHref = (href) => decodeURIComponent((href ?? "").replace(/^(https?:)?\/\/[^/]+/, "").replace(/^\/products\//, "").split(/[?#]/)[0]);
const subtitles = new Map();
const MONTHS = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
const reviewMap = new Map();
for (const f of allHtml) {
  const $ = load(f);
  if (/^(collection|collections-index|home)/.test(f))
    $(".bp-card").each((_, el) => {
      const handle = handleFromHref($(el).find(".bp-card__title a").attr("href"));
      const desc = text($(el).find(".bp-card__desc").text());
      if (handle && desc && !subtitles.has(handle)) subtitles.set(handle, desc);
    });
  $(".bp-review").each((_, el) => {
    const r = $(el);
    const name = text(r.find(".bp-review__name").text());
    const body = text(r.find(".bp-review__text").text());
    const meta = r.find(".bp-review__meta");
    const dm = /(\d{1,2}) ([a-z]+) (\d{4})/i.exec(text(meta.text()));
    const month = dm ? MONTHS.indexOf(dm[2].toLowerCase()) : -1;
    const date = dm && month >= 0 ? `${dm[3]}-${String(month + 1).padStart(2, "0")}-${dm[1].padStart(2, "0")}T12:00:00.000Z` : null;
    const rating = Number(/(\d) van 5/.exec(r.find(".bp-stars").attr("aria-label") ?? "")?.[1] ?? 0);
    const href = meta.find("a").attr("href");
    const handle = href ? handleFromHref(href) : null;
    const key = `${name}|${date}|${body.slice(0, 60)}`;
    if (!name || !body) return;
    if (!date) warn(`Review zonder datum: ${name}`);
    if (!rating) warn(`Review zonder score: ${name}`);
    const prev = reviewMap.get(key);
    if (!prev || (!prev.productSlug && handle))
      reviewMap.set(key, { name, rating, title: text(r.find(".bp-review__title").text()), text: body, date, verified: /geverifieerde koper/i.test(r.find(".bp-review__verified").text()), productSlug: handle ? slugOf.get(handle) ?? null : null, productName: handle ? text(meta.find("a").text()) : null });
  });
}
const reviews = [...reviewMap.values()].sort((a, b) => (a.date < b.date ? 1 : -1));

// ---------------------------------------------------------------------------------------------------------------
// Producten
// ---------------------------------------------------------------------------------------------------------------
// volgorde binnen elke collectie
const membership = new Map(); // handle → [{ path, position }]
const collectionOrder = new Map(); // categoriepad → [slug]
for (const [handle, catPath] of byHandle) {
  const f = `feed-collection-${handle}.json`;
  if (!exists(f)) {
    warn(`Geen feed voor collectie ${handle}`);
    continue;
  }
  const list = readJson(f).products;
  collectionOrder.set(catPath, list.map((p) => slugOf.get(p.handle)));
  list.forEach((p, i) => {
    if (!slugOf.has(p.handle)) return warn(`Product ${p.handle} uit collectie ${handle} staat niet in de productfeed`);
    (membership.get(p.handle) ?? membership.set(p.handle, []).get(p.handle)).push({ path: catPath, position: i });
  });
}

// zinnen: alleen splitsen op een leesteken dat gevolgd wordt door een spatie en een hoofdletter (niet in "WPS 2.4" of "1.100 kg")
const sentences = (s) => s.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý"'(])/).map((x) => x.trim()).filter(Boolean);
const cutWords = (s, max) => {
  if (s.length <= max) return s;
  const cut = s.slice(0, max + 1);
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[\s,;:–-]+$/, "");
};

/** Meta-description van 140–160 tekens uit de echte tekst: ondertitel + inleiding, aangevuld met een vaste slotzin. */
function metaDescription(parts, tails) {
  const all = parts.flatMap((p) => sentences(text(p))).map((s) => (/[.!?]$/.test(s) ? s : `${s}.`));
  let d = "";
  let rest = "";
  for (const s of all) {
    if (d && d.includes(s)) continue;
    const next = d ? `${d} ${s}` : s;
    if (next.length > 160) {
      rest = s;
      break;
    }
    d = next;
    if (d.length >= 140) break;
  }
  if (d.length >= 140) return d;
  // de volgende zin past niet meer: liever een hele slotzin dan een afgebroken zin
  const cutRest = () => {
    const room = 159 - (d ? d.length + 1 : 0);
    return room > 40 ? `${d ? `${d} ` : ""}${cutWords(rest, room - 1).replace(/[.,;:]$/, "")}…` : d;
  };
  if (rest && d.length < 90) return cutRest();
  // slotzinnen: de eerste combinatie (één, twee of drie zinnen) die binnen 140–160 tekens uitkomt
  const combos = [];
  for (const a of tails) combos.push([a]);
  for (const a of tails) for (const b of tails) if (a !== b) combos.push([a, b]);
  for (const a of tails) for (const b of tails) for (const c of tails) if (a !== b && b !== c && a !== c) combos.push([a, b, c]);
  for (const c of combos) {
    const next = `${d} ${c.join(" ")}`;
    if (next.length >= 140 && next.length <= 160) return next;
  }
  return rest ? cutRest() : d;
}

/** Meta-title van 45–60 tekens die eindigt op "| BluePure Marine". */
const TITLE_MIN = 45 - SUFFIX.length;
const TITLE_MAX = 60 - SUFFIX.length;
const TITLE_OVERRIDES = {
  // waar de automatische inkorting twee dezelfde titels of een onhandige afbreking zou geven
  "decktent-dog-ramp-meer-waterplezier-voor-jouw-hond": "Decktent Dog Ramp hondenloopplank maat L",
  "decktent-dog-ramp-meer-waterplezier-voor-jouw-hond-maat-m": "Decktent Dog Ramp hondenloopplank maat M",
  "decktent-sup-met-houtlook-stijlvol-het-water-op-maat-m": "Decktent SUP-board met houtlook maat M",
  "decktent-sup-met-houtlook-stijl-en-waterplezier-in-een-maat-xl": "Decktent SUP-board met houtlook maat XL",
  "formentera-opblaasboot-met-transparante-bodem": "Formentera opblaasboot transparant maat M",
  "formentera-opblaasboot-met-transparante-bodem-maat-l": "Formentera opblaasboot transparant maat L",
  "formentera-opblaasboot-met-transparante-bodem-maat-xl": "Formentera opblaasboot transparant maat XL",
  "bimini-decktent-s-wit-opblaasbare-zonwering-voor-je-boot": "Opblaasbare Bimini Decktent S wit",
  "bimini-decktent-s-wit-opblaasbare-zonwering-voor-je-boot-1": "Opblaasbare Bimini Decktent S+ wit",
  "bimini-decktent-s-zwart-opblaasbare-zonwering-voor-je-boot": "Opblaasbare Bimini Decktent S zwart",
  "bimini-decktent-m-wit-opblaasbare-zonwering-voor-je-boot": "Opblaasbare Bimini Decktent M wit",
  "bimini-decktent-l-wit-opblaasbare-zonwering-voor-je-boot": "Opblaasbare Bimini Decktent L wit",
  "bimini-decktent-xs-opblaasbare-zonwering-voor-je-boot": "Opblaasbare Bimini Decktent XS",
  "bimini-decktent-xs-zwart-opblaasbare-zonwering-voor-je-boot": "Opblaasbare Bimini Decktent XS zwart",
  "decktent-opblaasbaar-platform-amp-sup-jouw-eigen-plek-op-het-water": "Decktent platform & SUP 200 x 100 cm",
  "decktent-opblaasbaar-platform-250-150-cm-jouw-eigen-plek-op-het-water": "Decktent opblaasbaar platform 250 × 150 cm",
  "decktent-opblaasbaar-platform-300-200-cm-jouw-terras-op-het-water": "Decktent opblaasbaar platform 300 × 200 cm",
  "decktent-water-lounge-jouw-eigen-oase-op-het-water": "Decktent Water Lounge 250 cm drijvend dek",
  "decktent-water-lounge-rond-ontspannen-op-het-water": "Decktent Water Lounge rond 250 cm",
  "exterior-cleaner-interior-cleaner-oil-remover": "Alles in 1 pakket met drie bootreinigers",
  "propeller-cleaner-exterior-cleaner-exterior-cleaner": "Exterior pakket met drie bootreinigers",
  "desinfectie-exterior-cleaner-mold-remover": "Bestrijdingspakket met drie reinigers",
  "furuno-ds-830-digitale-snelheidsindicator-voor-ds-830-doppler-speed-log-2dekans-product": "Furuno DS-830 digitale snelheidsindicator",
  "furuno-gpa-018-gps-dgps-antenna-with-cable-marine-navigation-antenna": "Furuno GPA-018 GPS/DGPS-antenne met kabel",
  "garmin-gpsmap-923xsv-kaartplotter-gmr-18-hd3-koepelradar-9-inch-12-24-v": "Garmin GPSMAP 923xsv + GMR 18 HD3 radar",
  "volvo-penta-garmin-glass-cockpit-7-inch-mfd-12-24-v-inclusief-montagekit-23989003": "Volvo Penta Garmin Glass Cockpit 7 inch",
  "volvo-penta-elektronische-motorbediening-voor-ips-met-single-lever-functie": "Volvo Penta motorbediening voor IPS",
  "mercury-8m0133245-next-gen-triple-premier-electronic-remote-control-set": "Mercury 8M0133245 Next Gen Triple Premier",
  "mercury-dts-slim-console-single-trim-elektronische-motorbediening-8m0079291": "Mercury DTS Slim Console Single Trim",
  "harken-2727-small-boat-cb-kogelgelagerde-overloopwagen-met-scharnierende-sluiting": "Harken 2727 Small Boat CB overloopwagen",
  "harken-g326s-big-boat-32-mm-genuaslede-met-borgpen-en-schootblok": "Harken G326S Big Boat 32 mm genuaslede",
  "harken-small-boat-genua-slider-block-32-mm-genuablok-voor-zeilboten": "Harken Small Boat genuablok 32 mm",
  "lewmar-htx-60-mm-dubbelblok-met-hondsvot-gecontroleerde-zeilbediening-29196005": "Lewmar HTX 60 mm dubbelblok met hondsvot",
  "side-power-8960g-joystick-bedieningspaneel-voor-boegschroef-12-24-v": "Side-Power 8960G joystick voor boegschroef",
  "vetus-dbppja-proportioneel-joystickpaneel-voor-boeg-en-hekschroef": "Vetus DBPPJA proportioneel joystickpaneel",
  "vetus-set0159-elektromotor-12-v-met-solenoide-voor-bow95-bow125": "Vetus SET0159 elektromotor BOW95/BOW125",
  "radio-zeeland-falcon-f501-maritiem-bedieningspaneel-met-stuurhendel": "Radio Zeeland Falcon F501 bedieningspaneel",
  "ecstasea-solar-relingverlichting-set-van-4-voor-relingen-o-25-mm": "Ecstasea solar relingverlichting set van 4",
  "johnson-pump-aqua-jet-wps-2-4-automatische-drinkwaterpomp-9-l-min": "Johnson Pump Aqua Jet WPS 2.4 waterpomp",
  "johnson-pump-aqua-jet-wps-2-9-automatische-drinkwaterpomp-11-l-min": "Johnson Pump Aqua Jet WPS 2.9 waterpomp",
  "navico-windsensorkabel-20-meter-micro-c-naar-simnet-000-10757-001": "Navico windsensorkabel 20 m Micro-C SimNet",
  "ultraflex-b89-eenhendel-gas-en-schakelbediening-voor-boten": "Ultraflex B89 eenhendel motorbediening",
  "furuno-gps-navigator-maritiem-navigatiedisplay-met-montagebeugel": "Furuno GPS Navigator met montagebeugel",
  "harken-1516-midrange-enkel-overloop-eindblok": "Harken 1516 Midrange overloop-eindblok",
  "maxwell-p102816-hrc8-elektrische-ankerlier-8-mm-24-v": "Maxwell HRC8 elektrische ankerlier 24 V",
  "harken-129-38-mm-big-bullet-drievoudig-blok": "Harken 129 Big Bullet drievoudig blok",
  "harken-3047-aluminium-high-load-teardrop-blok-75-mm": "Harken 3047 High-Load Teardrop blok 75 mm",
  "quick-boegschroef-btq-125-12volt-30kgf-1-5kw": "Quick BTQ 125 boegschroef 30 kgf 12 V",
  "glass-cleaner": "Glass cleaner voor je boot kopen",
  "mold-remover": "Mold remover schimmelverwijderaar",
  "oil-remover": "Oil remover ontvetter voor je boot",
  desinfectie: "Desinfectie voor het bootinterieur",
  "exterior-cleaner-5liter": "Exterior cleaner 5 liter grootverpakking",
  "interior-cleaner-5liter": "Interior cleaner 5 liter grootverpakking",
  "oil-remover-5liter": "Oil remover 5 liter grootverpakking",
  "propeller-cleaner-5liter": "Propeller cleaner 5 liter grootverpakking",
  "exterior-cleaner-1": "Exterior + cleaner voor zware vervuiling",
  "exterior-cleaner-5liter-1": "Exterior + cleaner 5 liter grootverpakking",
};
function metaTitle(slug, name, type) {
  const fits = (s) => s.length >= TITLE_MIN && s.length <= TITLE_MAX;
  if (TITLE_OVERRIDES[slug]) return TITLE_OVERRIDES[slug];
  const base = text(name.replace(/®/g, ""));
  const segs = base.split(/\s+[–-]\s+/);
  const tries = [base];
  for (let n = segs.length - 1; n >= 1; n--) tries.push(segs.slice(0, n).join(" – "));
  for (const t of tries) if (fits(t)) return capital(t);
  // te lang: afkappen op een woordgrens, zonder los voorzetsel of leesteken aan het eind
  const cut = cutWords(base, TITLE_MAX).replace(/(\s+(met|voor|en|van|in|op|naar|of|tot|[–+-]))+$/i, "").replace(/[\s,–-]+$/, "");
  if (fits(cut)) return capital(cut);
  const short = tries.find((t) => t.length <= TITLE_MAX) ?? cutWords(segs[0], TITLE_MAX).replace(/\s+(met|voor|en|van|in|op)$/i, "");
  const lower = type.toLowerCase();
  const add = [" kopen", " online kopen", ` ${lower} kopen`, ` ${lower} online kopen`, " voor je boot kopen", ` – ${lower} voor je boot`, ` ${lower} voor je boot kopen`].filter((a) => !a.includes(lower) || !short.toLowerCase().includes(lower));
  for (const a of add) if (fits(short + a)) return capital(short + a);
  return capital(short);
}

const galleryAlt = ($, i) => text($(".bpdp-gallery .bpdp-slide img").eq(i).attr("alt") ?? "");
const images = []; // content/images.json
const brandNames = new Map();
const products = [];
const known = fs.existsSync(path.join(root, "scripts", "known-urls.txt"))
  ? fs.readFileSync(path.join(root, "scripts", "known-urls.txt"), "utf8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  : [];

for (const fp of feedProducts) {
  const slug = slugOf.get(fp.handle);
  const file = htmlName("product", fp.handle);
  const $ = exists(file) ? load(file) : null;
  if (!$) warn(`Geen HTML voor product ${fp.handle}`);
  const v = fp.variants[0];
  if (fp.variants.length > 1) warn(`Product ${fp.handle} heeft ${fp.variants.length} varianten: alleen de eerste is overgenomen`);

  // specificaties: uitklapblok (label in <strong>, waarde erachter); anders de tabel uit de omschrijving
  let specs = [];
  if ($)
    $(".bpdp-acc__body--specificaties li").each((_, li) => {
      const label = text($(li).find("strong").first().text()).replace(/:$/, "");
      const clone = $(li).clone();
      clone.find("strong").first().remove();
      const value = text(clone.text()).replace(/^:\s*/, "");
      if (label && value) specs.push({ label, value });
    });
  if (!specs.length) {
    const $b = cheerio.load(fp.body_html ?? "", null, false);
    $b("table tr").each((_, tr) => {
      const cells = $b(tr).find("td");
      if (cells.length === 2) specs.push({ label: text(cells.eq(0).text()).replace(/:$/, ""), value: text(cells.eq(1).text()) });
    });
  }
  if (!specs.some((s) => s.label.toLowerCase() === "merk") && fp.vendor && fp.vendor !== "Overig") specs.unshift({ label: "Merk", value: fp.vendor });

  // gebruik en onderhoud
  let usage = "";
  if ($)
    $(".bpdp-acc").each((_, el) => {
      if (/gebruik en onderhoud/i.test($(el).find("summary").text())) usage = cleanHtml($(el).find(".bpdp-acc__body").html());
    });

  // kruimelpad → primaire categorie (de diepste)
  const crumbHandles = $ ? $(".bpdp-crumbs li a").map((_, a) => $(a).attr("href")).get().map((h) => /\/collections\/([^/?#]+)/.exec(h)?.[1]).filter(Boolean) : [];
  const member = membership.get(fp.handle) ?? [];
  let primary = null;
  for (const h of crumbHandles) if (byHandle.has(h)) primary = byHandle.get(h);
  if (!primary) {
    primary = member.find((m) => m.path !== "/bestsellers/")?.path ?? null;
    warn(`Geen bruikbaar kruimelpad voor ${fp.handle}: primaire categorie ${primary}`);
  }
  if (primary && !member.some((m) => m.path === primary)) member.push({ path: primary, position: 999 });

  // voorraad: de feed geeft alleen beschikbaar ja/nee; de productpagina noemt soms "Nog 2 op voorraad"
  const available = fp.variants.some((x) => x.available);
  const stockText = $ ? text($(".bpdp-stock").text()) : "";
  const few = /nog (\d+) op voorraad/i.exec(stockText);
  const stock = !available ? 0 : few ? Number(few[1]) : 25;

  const ld = $
    ? $('script[type="application/ld+json"]').map((_, e) => $(e).html()).get().map((s) => { try { return JSON.parse(s); } catch { return null; } }).find((o) => o && o["@type"] === "Product")
    : null;

  const lead = $ ? text($(".bpdp-lead__text").text()) : "";
  let subtitle = subtitles.get(fp.handle) ?? "";
  if (!subtitle) {
    const t = specs.find((s) => /^(type|producttype)$/i.test(s.label))?.value ?? "";
    subtitle = t && t.length <= 70 ? t : "";
    warn(`Geen ondertitel op een productkaart voor ${fp.handle}: ${subtitle ? `"${subtitle}" uit de specificaties` : "leeg gelaten"}`);
  }
  const name = text(fp.title);
  const description = promoteHeadings(cleanHtml(fp.body_html), "h3");

  const imgs = fp.images.map((im, i) => {
    const dest = `/uploads/products/${slug}-${i + 1}.webp`;
    const alt = ($ && galleryAlt($, i)) || name;
    const altText = i > 0 && alt === name ? `${name} – afbeelding ${i + 1}` : alt;
    images.push({ src: im.src, dest, alt: altText, folder: "producten", kind: "photo", product: slug, sourceWidth: im.width, sourceHeight: im.height });
    return { src: dest, alt: altText };
  });
  if (!imgs.length) warn(`Product zonder afbeelding: ${fp.handle}`);

  if (fp.vendor) brandNames.set(fp.vendor, (brandNames.get(fp.vendor) ?? 0) + 1);
  const tails = ["Bestel online bij BluePure Marine.", "Gratis verzending vanaf € 75.", "Met persoonlijk advies.", "Bestel bij BluePure Marine.", "14 dagen bedenktijd.", "Bekijk de specificaties."];
  products.push({
    slug,
    sourceHandle: fp.handle,
    path: `/producten/${slug}/`,
    name,
    subtitle,
    lead,
    description,
    usage,
    specs,
    images: imgs,
    productType: fp.product_type ?? "",
    vendor: fp.vendor ?? "",
    brandSlug: fp.vendor ? slugify(fp.vendor) : null,
    primaryCategory: primary,
    categories: member.sort((a, b) => a.path.localeCompare(b.path)),
    featured: member.some((m) => m.path === "/bestsellers/"),
    price: cents(v.price),
    compareAtPrice: cents(v.compare_at_price) && cents(v.compare_at_price) > cents(v.price) ? cents(v.compare_at_price) : null,
    sku: v.sku || ld?.sku || null,
    ean: ld?.gtin ?? ld?.gtin13 ?? null,
    weight: v.grams ?? 0,
    available,
    stock,
    stockSource: few ? "productpagina" : "aanname",
    publishedAt: fp.published_at,
    metaTitle: metaTitle(slug, name, fp.product_type ?? "") + SUFFIX,
    metaDescription: metaDescription([subtitle, lead || stripTags(description)], tails),
    oldMetaDescription: $ ? text(($('meta[name="description"]').attr("content") ?? "").replace(/&amp;/g, "&")) : "",
  });
}
products.sort((a, b) => a.name.localeCompare(b.name, "nl"));

// controle met de lijst van de klant
const knownHandles = known.map((u) => /\/products\/([^/?#]+)/.exec(u)?.[1]).filter(Boolean).map((h) => decodeURIComponent(h));
const missing = knownHandles.filter((h) => !slugOf.has(h));
const extra = [...slugOf.keys()].filter((h) => !knownHandles.includes(h));

// ---------------------------------------------------------------------------------------------------------------
// Categorieën aanvullen: beschrijving van de oude collectie, afbeelding (hoofdfoto van het eerste product), volgorde
// ---------------------------------------------------------------------------------------------------------------
const feedCollections = readJson("feed-collections.json").collections;
const bySlug = new Map(products.map((p) => [p.slug, p]));
for (const c of categories) {
  const fc = c.sourceHandle ? feedCollections.find((x) => x.handle === c.sourceHandle) : null;
  if (c.sourceHandle && !fc) warn(`Collectie ${c.sourceHandle} staat niet in feed-collections.json`);
  c.sourceTitle = fc?.title ?? null;
  c.description = fc?.description ? promoteHeadings(cleanHtml(fc.description), "h2") : "";
  c.products = collectionOrder.get(c.path) ?? [];
  const file = c.sourceHandle ? htmlName("collection", c.sourceHandle) : null;
  if (file && exists(file)) {
    const $ = load(file);
    c.sourceCount = Number(/(\d+)/.exec($(".bcol-bar__count").text())?.[1] ?? c.products.length);
    if (c.sourceCount !== c.products.length) warn(`Collectie ${c.sourceHandle}: pagina noemt ${c.sourceCount} producten, feed heeft er ${c.products.length}`);
  }
}
for (const c of categories) {
  const own = c.products.length ? c.products : categories.filter((x) => x.parentPath === c.path).flatMap((x) => x.products);
  const first = bySlug.get(own[0]);
  c.image = first?.images[0]?.src ?? null;
  c.imageAlt = first ? `${c.name}: ${first.name}` : "";
}
for (const fc of feedCollections) if (!byHandle.has(fc.handle)) warn(`Collectie ${fc.handle} heeft geen plek in de categorieboom`);

// ---------------------------------------------------------------------------------------------------------------
// Merken (met de logo's van de homepage)
// ---------------------------------------------------------------------------------------------------------------
const $home = load("home.html");
const assetUrl = (src) => {
  const u = src.replace(/^\/\//, "https://").split("&width=")[0];
  // dezelfde afbeelding op het CDN (de winkel-host geeft sneller een 429)
  const cdn = u.replace(/^https:\/\/www\.bluepuremarine\.com\/cdn\/shop\//, `${CDN}/`);
  return { src: cdn, fallback: u };
};
const logos = new Map();
$home(".bp-brands__logo, .bp-brands__tile img").each((_, el) => {
  const src = $home(el).attr("src");
  const m = /bp-merk-([a-z0-9-]+)\.(svg|png)/.exec(src ?? "");
  if (!m) return;
  const dest = `/brands/${m[1]}.${m[2]}`;
  if (logos.has(m[1])) return;
  logos.set(m[1], dest);
  images.push({ ...assetUrl(src), dest, alt: `Logo ${text($home(el).attr("alt") ?? m[1])}`, folder: "merken", kind: "raw" });
});
const BRAND_ORDER = ["BluePure Marine", "Harken", "Lewmar", "Vetus", "Quick", "Garmin", "Furuno", "Mercury", "Volvo Penta"];
const brands = [...brandNames.entries()]
  .map(([name, count]) => ({ slug: slugify(name), name: name === "Overig" ? "Overige merken" : name, sourceVendor: name, logo: name === BRAND ? "/logo.svg" : logos.get(slugify(name)) ?? null, count }))
  .sort((a, b) => {
    const ia = BRAND_ORDER.indexOf(a.sourceVendor);
    const ib = BRAND_ORDER.indexOf(b.sourceVendor);
    if (a.sourceVendor === "Overig") return 1;
    if (b.sourceVendor === "Overig") return -1;
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.name.localeCompare(b.name, "nl");
  })
  .map((b, i) => ({ ...b, sortOrder: (i + 1) * 10 }));
for (const [slug] of logos) if (!brands.some((b) => b.slug === slug)) warn(`Merklogo zonder producten: ${slug}`);

// sfeerbeelden van de homepage en de foto van de contactpagina
const HOME_IMAGES = [
  { match: "marine_producten_afbeelding", dest: "/uploads/home/hero-producten.webp", alt: "De reinigingslijn van BluePure Marine: flessen cleaner voor exterieur, interieur en schroef" },
  { match: "Mint-Marine_Princess-V40_Rascal_06_1", dest: "/uploads/home/jacht.webp", alt: "Motorjacht op het water" },
  { match: "Kajuit-zeilboot", dest: "/uploads/home/kajuit.webp", alt: "Kajuit van een zeilboot" },
];
for (const h of HOME_IMAGES) {
  const src = $home("img").map((_, e) => $home(e).attr("src")).get().find((s) => s.includes(h.match));
  if (!src) {
    warn(`Sfeerbeeld ${h.match} niet gevonden in home.html`);
    continue;
  }
  images.push({ ...assetUrl(src), dest: h.dest, alt: h.alt, folder: "home", kind: "photo" });
}

// ---------------------------------------------------------------------------------------------------------------
// Pagina's, beleidsteksten, veelgestelde vragen
// ---------------------------------------------------------------------------------------------------------------
const feedPages = readJson("feed-pages.json").pages;
const pages = [];
for (const fp of feedPages) {
  const target = PAGE_PATHS[fp.handle];
  if (!target) {
    warn(`Pagina ${fp.handle} heeft geen nieuw pad`);
    continue;
  }
  const file = `page-${fp.handle}.html`;
  const $ = exists(file) ? load(file) : null;
  const html = promoteHeadings(cleanHtml(fp.body_html ?? ""));
  const page = { source: `/pages/${fp.handle}`, key: target.key, path: target.path, title: text(fp.title), html, oldMetaDescription: $ ? text($('meta[name="description"]').attr("content") ?? "") : "", updatedAt: fp.updated_at ?? null };
  if (fp.handle === "contact" && $) {
    // geen body in de feed: de zichtbare contactinformatie uit de HTML
    const company = {};
    $(".bcompany__col").each((_, col) => {
      company[text($(col).find("dt").text())] = $(col).find("dd").map((_, dd) => text($(dd).text())).get();
    });
    const imgSrc = $(".bcontact__image").attr("src");
    if (imgSrc) images.push({ ...assetUrl(imgSrc), dest: "/uploads/home/contact.webp", alt: "Boot op het water", folder: "home", kind: "photo" });
    page.contact = {
      heading: text($(".bcontact__title").text()),
      intro: text($(".bcontact__text").text()),
      subjects: $("#ContactForm-subject option").map((_, o) => text($(o).text())).get(),
      messageLabel: text($('label[for="ContactForm-body"]').text()).replace(/\s*\*$/, ""),
      note: cleanHtml($(".bcontact__note").html()),
      submitLabel: text($(".bcontact__submit").text()),
      company,
      image: imgSrc ? "/uploads/home/contact.webp" : null,
    };
  }
  if (fp.handle === "veelgestelde-vragen" && $) {
    page.intro = text($(".bfaq-hero__intro").text());
    page.help = { heading: text($("#contact .bp-advice__title").text()), text: text($("#contact .bp-advice__lead").text()) };
  }
  pages.push(page);
}
for (const f of allHtml.filter((f) => f.startsWith("policy-"))) {
  const handle = f.replace(/^policy-|\.html$/g, "");
  const $ = load(f);
  const html = promoteHeadings(cleanHtml($(".shopify-policy__body .rte").html() ?? ""));
  pages.push({ source: `/policies/${handle}`, key: `policy:${handle}`, path: POLICY_PATHS[handle] ?? null, title: text($(".shopify-policy__title").text()), html, oldMetaDescription: "", updatedAt: null });
}

// "Over BluePure Marine" van de homepage → /over-ons/
const about = $home(".bp-about__row").map((_, row) => ({ eyebrow: text($home(row).find(".bp-about__eyebrow").text()), heading: text($home(row).find(".bp-about__heading").text()), html: cleanHtml($home(row).find(".bp-about__body").html()) })).get();
const advice = { heading: text($home(".bp-advice__title").text()), text: text($home(".bp-advice__lead").text()) };
const home = {
  metaDescription: text($home('meta[name="description"]').attr("content") ?? ""),
  hero: { eyebrow: text($home(".bp-hero__eyebrow").text()), heading: text($home(".bp-hero__heading").text()), lead: text($home(".bp-hero__lead").text()) },
  ownBrand: { title: text($home(".bp-feat__title").text()), text: text($home(".bp-feat__text").text()) },
  brands: { title: text($home(".bp-brands__title").text()), sub: text($home(".bp-brands__sub").text()) },
  about,
  advice,
};

const faqs = [];
{
  const $ = load("page-veelgestelde-vragen.html");
  $(".bfaq-group").each((_, g) => {
    const category = text($(g).find(".bfaq-group__title").text());
    $(g).find(".bfaq-item").each((_, it) => {
      const question = text($(it).find("[data-faq-question]").text());
      const answer = cleanHtml($(it).find(".bfaq-item__answer").html());
      if (question && answer) faqs.push({ category, anchor: $(it).attr("id") ?? "", question, answer, sortOrder: (faqs.length + 1) * 10 });
    });
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Redirects (301) van elke oude URL naar de nieuwe. `from` in kleine letters, met slash aan begin en eind.
// ---------------------------------------------------------------------------------------------------------------
const redirectMap = new Map();
const redirect = (from, to) => {
  const f = `${from.toLowerCase().replace(/\/+$/, "")}/`;
  if (f === to) return;
  if (redirectMap.has(f) && redirectMap.get(f) !== to) warn(`Redirect ${f} heeft twee doelen`);
  redirectMap.set(f, to);
};
for (const [handle, catPath] of byHandle) redirect(`/collections/${handle}`, catPath);
redirect("/collections/all", "/bootonderdelen/");
redirect("/collections", "/bootonderdelen/");
for (const p of products) {
  redirect(`/products/${p.sourceHandle}`, p.path);
  // handles met bijzondere tekens komen ook procent-gecodeerd binnen
  if (encodeURI(p.sourceHandle) !== p.sourceHandle) redirect(`/products/${encodeURI(p.sourceHandle)}`, p.path);
  for (const c of p.categories) {
    const old = categories.find((x) => x.path === c.path)?.sourceHandle;
    if (old) redirect(`/collections/${old}/products/${p.sourceHandle}`, p.path);
  }
}
for (const [handle, t] of Object.entries(PAGE_PATHS)) redirect(`/pages/${handle}`, t.path);
for (const [handle, to] of Object.entries(POLICY_PATHS)) redirect(`/policies/${handle}`, to);
redirect("/cart", "/winkelwagen/");
redirect("/account/login", "/account/inloggen/");
redirect("/account/register", "/account/registreren/");
redirect("/search", "/zoeken/");
const redirects = [...redirectMap.entries()].map(([from, to]) => ({ from, to }));

// ---------------------------------------------------------------------------------------------------------------
// Afbeeldingen: afmetingen van een eerdere download bewaren
// ---------------------------------------------------------------------------------------------------------------
const prevImages = fs.existsSync(path.join(out, "images.json")) ? JSON.parse(fs.readFileSync(path.join(out, "images.json"), "utf8")) : [];
const prevByDest = new Map(prevImages.map((i) => [i.dest, i]));
for (const im of images) {
  const prev = prevByDest.get(im.dest);
  if (prev && prev.src === im.src && prev.width) Object.assign(im, { width: prev.width, height: prev.height, size: prev.size });
}

// ---------------------------------------------------------------------------------------------------------------
// Controles
// ---------------------------------------------------------------------------------------------------------------
const titleSeen = new Map();
for (const item of [...products.map((p) => ({ id: p.slug, t: p.metaTitle, d: p.metaDescription })), ...categories.map((c) => ({ id: c.path, t: c.metaTitle, d: c.metaDescription }))]) {
  if (item.t.length < 45 || item.t.length > 60) warn(`Meta-title ${item.t.length} tekens (${item.id}): ${item.t}`);
  if (item.d.length < 140 || item.d.length > 160) warn(`Meta-description ${item.d.length} tekens (${item.id}): ${item.d}`);
  if (titleSeen.has(item.t)) warn(`Dubbele meta-title: ${item.t} (${item.id} en ${titleSeen.get(item.t)})`);
  titleSeen.set(item.t, item.id);
}
for (const p of products) {
  if (!p.lead) warn(`Geen inleiding (.bpdp-lead__text) voor ${p.slug}`);
  if (!p.specs.length) warn(`Geen specificaties voor ${p.slug}`);
  if (!p.primaryCategory) warn(`Geen primaire categorie voor ${p.slug}`);
}
if (reviews.length !== 8) warn(`Verwacht 8 reviews, gevonden: ${reviews.length}`);

write("products", products);
write("categories", categories);
write("brands", brands);
write("pages", { pages, home });
write("faqs", faqs);
write("reviews", reviews);
write("redirects", redirects);
write("images", images);

const avg = reviews.reduce((n, r) => n + r.rating, 0) / (reviews.length || 1);
console.log(`Producten: ${products.length} | categorieën: ${categories.length} | merken: ${brands.length} | pagina's: ${pages.length} | vragen: ${faqs.length}`);
console.log(`Reviews: ${reviews.length} (gemiddeld ${avg.toFixed(2)}) | redirects: ${redirects.length} | afbeeldingen: ${images.length}`);
console.log(`Lijst van de klant: ${knownHandles.length} product-URL's, ${missing.length} ontbreken in de feed${missing.length ? `: ${missing.join(", ")}` : ""}; ${extra.length} producten staan niet in de lijst${extra.length ? `: ${extra.join(", ")}` : ""}`);
if (warnings.length) {
  console.log(`\n${warnings.length} opmerkingen:`);
  for (const w of [...new Set(warnings)]) console.log(" -", w);
}
