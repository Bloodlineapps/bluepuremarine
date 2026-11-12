import "server-only";
import sanitizeHtml from "sanitize-html";

// HTML uit de rich-text-editor wordt bij opslaan opgeschoond: alleen inhoudelijke tags, veilige attributen.
export function cleanHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ["h2", "h3", "h4", "p", "ul", "ol", "li", "a", "strong", "em", "br", "img", "blockquote", "table", "thead", "tbody", "tr", "th", "td", "figure", "figcaption", "iframe", "hr", "details", "summary", "u", "sup", "sub"],
    allowedAttributes: { a: ["href", "title", "rel"], img: ["src", "alt"], iframe: ["src", "title", "allow", "allowfullscreen"], td: ["colspan", "rowspan"], th: ["colspan", "rowspan"] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedIframeHostnames: ["www.youtube.com", "www.youtube-nocookie.com", "player.vimeo.com"],
    transformTags: {
      b: "strong",
      i: "em",
      h1: "h2",
      div: "p",
      a: (tagName, attribs) => {
        // interne links altijd relatief en met slash aan het eind
        let href = attribs.href ?? "";
        const m = /^https?:\/\/(www\.)?bluepuremarine\.com(\/[^?#]*)?(.*)$/i.exec(href);
        if (m) href = (m[2] || "/") + (m[3] || "");
        if (href.startsWith("/") && !/\.[a-z0-9]{2,5}($|[?#])/i.test(href)) href = href.replace(/^([^?#]*?)\/?([?#].*)?$/, (_, p, q) => `${p}/${q ?? ""}`);
        const rel = attribs.rel && /sponsored|ugc/.test(attribs.rel) ? attribs.rel.match(/sponsored|ugc/g)!.join(" ") : undefined;
        return { tagName, attribs: { href, ...(attribs.title ? { title: attribs.title } : {}), ...(rel ? { rel } : {}) } };
      },
    },
  })
    .replace(/<p>\s*(<br \/>)?\s*<\/p>/g, "")
    .trim();
}
