import "server-only";
import { cache } from "react";
import { db } from "./db";

// CMS-HTML klaarmaken voor weergave: externe links in een nieuw tabblad (met rel en schermlezertekst),
// afbeeldingen met width/height en lazy loading, tabellen scrollbaar op mobiel.

const mediaSizes = cache(async () => {
  const rows = await db.media.findMany({ select: { path: true, width: true, height: true } });
  return new Map(rows.map((r) => [r.path, r]));
});

export function isExternal(href: string) {
  if (!/^https?:\/\//i.test(href)) return false;
  try {
    const host = new URL(href).hostname;
    return !/(^|\.)bluepuremarine\.com$/i.test(host);
  } catch {
    return false;
  }
}

const redirectMap = cache(async () => {
  const rows = await db.redirect.findMany({ select: { from: true, to: true } });
  return new Map(rows.map((r) => [r.from, r.to]));
});

/** Oude/kapotte interne links uit geïmporteerde content repareren en via redirects naar de eindbestemming sturen. */
function fixInternal(href: string, redirects: Map<string, string>) {
  let h = href.replace(/^\/(www\.)?bluepuremarine\.com/i, "").replace(/(%20|\s).*$/, "");
  const [p, rest = ""] = h.split(/(?=[?#])/);
  let path = p.endsWith("/") || /\.[a-z0-9]{2,5}$/i.test(p) ? p : `${p}/`;
  for (let i = 0; i < 5 && redirects.has(path); i++) path = redirects.get(path)!;
  h = path + rest;
  return h;
}

const plainText = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const slug = (s: string) =>
  plainText(s)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Overgebleven WPBakery-shortcodes uit de oude site ([vc_row], [vc_title …]) opruimen. */
function cleanLegacy(html: string) {
  return html
    .replace(/\[vc_title[^\]]*?title=[”"“]([^”"“]+)[”"“][^\]]*?(?:resttitle=[”"“]([^”"“]+)[”"“])?[^\]]*\]/g, (_, t: string, rest?: string) => `<h2>${t}</h2>${rest ? `<p><strong>${rest}</strong></p>` : ""}`)
    .replace(/\[\/?(?:vc|av|et_pb)_[^\]]*\]/g, "")
    .replace(/<p>\s*<\/p>/g, "");
}

/** Koppen zonder inhoud (bv. een slider die niet meer bestaat) weglaten: kop direct gevolgd door een even hoge of hogere kop. */
function dropEmptyHeadings(html: string) {
  let prev = "";
  let out = html;
  while (out !== prev) {
    prev = out;
    out = out.replace(/<(h([2-4]))>((?:(?!<\/h[2-4]>)[\s\S])*?)<\/h[2-4]>\s*(?=<h([2-4])[\s>]|$)/g, (all, _tag, level: string, _inner, next?: string) => (!next || Number(next) <= Number(level) ? "" : all));
  }
  return out;
}

const STEP_TITLE = /(hoe verloopt|stappenplan|in \d+ stappen|zo werkt het|werkwijze)/i;

/** Een stappenplan (H2 met drie of meer H3 + tekst eronder) wordt een genummerde tijdlijn met golvende lijn. */
// inhoud van één stap: alinea's, lijsten, figuren en afbeeldingen
const STEP_BODY = String.raw`(?:(?:<(?:p|ul|ol|figure|blockquote)>[\s\S]*?<\/(?:p|ul|ol|figure|blockquote)>|<img [^>]*>)\s*)+`;

function stepsBlocks(html: string) {
  return html.replace(new RegExp(String.raw`<h2>([^<]*)<\/h2>((?:\s*<h3>[\s\S]*?<\/h3>\s*${STEP_BODY}){3,})`, "g"), (all, title: string, body: string) => {
    if (!STEP_TITLE.test(title)) return all;
    const steps = [...body.matchAll(new RegExp(String.raw`<h3>([\s\S]*?)<\/h3>\s*(${STEP_BODY})`, "g"))];
    // "#1 Stem de stijl…" → "Stem de stijl…": het nummer staat al in het rondje
    const items = steps.map((m, i) => `<li class="step"><span class="step-num" aria-hidden="true">${i + 1}</span><div class="step-body"><p class="step-label">Stap ${i + 1}</p><h3>${plainText(m[1]).replace(/^(#|stap\s*)?\d+[.:)]?\s+/i, "")}</h3>${m[2].trim()}</div></li>`);
    return `<h2>${title}</h2><ol class="steps">${items.join("")}</ol>`;
  });
}

/**
 * Blokken van de oude site "kop + foto met link + knop" (bv. Bride to be / Groom to be / Doorpassen op
 * /afspraak-maken/): twee of meer achter elkaar worden even grote tegels naast elkaar.
 */
const TILE = String.raw`<h3>([^<]+)<\/h3>\s*(?:<figure>\s*)?<a href="([^"]+)">\s*(<img [^>]*>)\s*<\/a>\s*(?:<figcaption>\s*<\/figcaption>\s*)?(?:<\/figure>\s*)?<a href="\2">\s*([^<]+?)\s*<\/a>`;
function ctaTiles(html: string) {
  return html.replace(new RegExp(String.raw`(?:${TILE}\s*){2,}`, "g"), (block) => {
    const tiles = [...block.matchAll(new RegExp(TILE, "g"))].map(
      ([, title, href, img, label]) => `<a class="tile" href="${href}">${img}<span class="tile-title">${title.trim()}</span><span class="tile-btn">${label.trim().toLowerCase().replace(/^./, (c) => c.toUpperCase())}</span></a>`,
    );
    return `<div class="tiles">${tiles.join("")}</div>`;
  });
}

/** Elke H2 krijgt een id, zodat je ernaartoe kunt linken (inhoudsopgave FAQ-pagina). */
function anchorHeadings(html: string) {
  const used = new Map<string, number>();
  return html.replace(/<h2>([\s\S]*?)<\/h2>/g, (_, inner: string) => {
    let id = slug(inner) || "sectie";
    const n = used.get(id) ?? 0;
    used.set(id, n + 1);
    if (n) id = `${id}-${n + 1}`;
    return `<h2 id="${id}">${inner}</h2>`;
  });
}

/** Inhoudelijke bewerkingen (zonder database): opruimen, stappenplannen en ankers. */
export function prepareHtml(html: string) {
  return anchorHeadings(ctaTiles(stepsBlocks(dropEmptyHeadings(cleanLegacy(html)))));
}

/** H2's met hun anker, voor een inhoudsopgave. */
export function headingsOf(html: string) {
  return [...prepareHtml(html).matchAll(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g)].map((m) => ({ id: m[1], text: plainText(m[2]) }));
}

/** Haalt een FAQ-blok (kop "Veelgestelde vragen" + uitklapvragen) uit de tekst, voor pagina's die de FAQ apart tonen. */
export function withoutFaqSection(html: string) {
  return html.replace(/<h2>\s*(?:veelgestelde vragen|faq)[^<]*<\/h2>\s*(?:<details>[\s\S]*?<\/details>\s*)+/gi, "");
}

export async function renderHtml(html: string | null | undefined, opts: { eagerFirstImage?: boolean; externalNote?: string } = {}) {
  if (!html) return "";
  const [sizes, redirects] = await Promise.all([mediaSizes(), redirectMap()]);
  let first = true;
  return prepareHtml(html)
    .replace(/<a ([^>]*?)href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/g, (all, pre: string, href: string, post: string, inner: string) => {
      if (href.startsWith("/")) return `<a ${pre}href="${fixInternal(href, redirects)}"${post}>${inner}</a>`;
      if (/^https?:\/\//i.test(href)) {
        try {
          if (!new URL(href).hostname.includes(".")) return inner;
        } catch {
          return inner; // ongeldige link uit de oude content: alleen de tekst tonen
        }
      }
      if (!isExternal(href)) return all;
      const rel = /rel="[^"]*(sponsored|ugc)[^"]*"/.exec(pre + post)?.[1];
      const attrs = `${pre}${post}`.replace(/\s*(target|rel)="[^"]*"/g, "");
      return `<a ${attrs.trim() ? `${attrs.trim()} ` : ""}href="${href}" target="_blank" rel="noopener noreferrer${rel ? ` ${rel}` : ""}">${inner}<span class="sr-only"> ${opts.externalNote ?? "(opent in een nieuw tabblad)"}</span></a>`;
    })
    .replace(/<img ([^>]*?)src="([^"]+)"([^>]*?)\/?>/g, (all, pre: string, src: string, post: string) => {
      const attrs = `${pre}${post}`.replace(/\s*(width|height|loading|decoding)="[^"]*"/g, "").trim();
      const s = sizes.get(src);
      const dims = s?.width && s?.height ? ` width="${s.width}" height="${s.height}"` : "";
      const loading = opts.eagerFirstImage && first ? ' fetchpriority="high"' : ' loading="lazy" decoding="async"';
      first = false;
      return `<img ${attrs.includes("alt=") ? attrs : `${attrs} alt=""`} src="${src}"${dims}${loading} />`;
    })
    .replace(/<table>/g, '<div class="table-wrap"><table>')
    .replace(/<\/table>/g, "</table></div>");
}
