// Blokken-editor: een pagina bestaat uit een hero (titel, inleiding, beeld, knop) en daaronder een lijst blokken.
// Gedeeld door de site (weergave), het beheer (editor) en de seed. Geen server-only.

export type SectionLayout = "split" | "wide" | "band" | "image";

export type Block =
  | { id: string; type: "section"; heading: string; html: string; layout: SectionLayout; image?: string; imageAlt?: string }
  | { id: string; type: "text"; html: string }
  | { id: string; type: "image"; src: string; alt: string; caption?: string }
  | { id: string; type: "buttons"; items: { label: string; href: string; style: "primary" | "secondary" }[] }
  | { id: string; type: "cards"; heading: string; items: { title: string; html: string; href: string; key?: string | null }[] }
  | { id: string; type: "children"; heading: string }
  | { id: string; type: "faq"; heading: string; html: string }
  | { id: string; type: "logos"; heading: string; items: { src: string; alt: string; href?: string | null }[] }
  | { id: string; type: "form"; heading: string; html: string; note?: string; formKey: string }
  | { id: string; type: "cta"; html: string; label: string; href: string };

export type BlockType = Block["type"];

export const BLOCK_LABELS: Record<BlockType, { label: string; help: string }> = {
  section: { label: "Sectie", help: "Kop (H2) met tekst; kies een opmaak" },
  text: { label: "Tekst", help: "Vrije tekst met opmaak" },
  image: { label: "Afbeelding", help: "Grote foto met bijschrift" },
  buttons: { label: "Knoppen", help: "Eén of twee knoppen" },
  cards: { label: "Kaarten", help: "Kaarten met titel, tekst en link" },
  children: { label: "Onderliggende pagina's", help: "Automatisch: de pagina's onder deze pagina" },
  faq: { label: "Veelgestelde vragen", help: "Vragen uit Beheer → Veelgestelde vragen" },
  logos: { label: "Logo's", help: "Rij met logo's (met link)" },
  form: { label: "Formulier", help: "Formulier uit de formulierbouwer" },
  cta: { label: "Afsluitende oproep", help: "Tekst met knop naar de volgende stap" },
};

export const LAYOUT_LABELS: Record<SectionLayout, string> = { split: "Kop links, tekst rechts", wide: "Breed (grote kop boven de tekst)", band: "Donkere band", image: "Met foto" };

export function parseBlocks(json: string | null | undefined): Block[] {
  try {
    const v = JSON.parse(json || "[]");
    return Array.isArray(v) ? (v as Block[]) : [];
  } catch {
    return [];
  }
}

export const newBlockId = () => `b${Math.random().toString(36).slice(2, 9)}`;

export function emptyBlock(type: BlockType): Block {
  const id = newBlockId();
  switch (type) {
    case "section":
      return { id, type, heading: "", html: "", layout: "split" };
    case "text":
      return { id, type, html: "" };
    case "image":
      return { id, type, src: "", alt: "", caption: "" };
    case "buttons":
      return { id, type, items: [{ label: "", href: "", style: "primary" }] };
    case "cards":
      return { id, type, heading: "", items: [] };
    case "children":
      return { id, type, heading: "" };
    case "faq":
      return { id, type, heading: "", html: "" };
    case "logos":
      return { id, type, heading: "", items: [] };
    case "form":
      return { id, type, heading: "", html: "", formKey: "contact" };
    case "cta":
      return { id, type, html: "", label: "", href: "/contact/" };
  }
}

/** Alle HTML-velden van een blok (voor opschonen, zoeken naar media en woorden tellen). */
export function blockHtml(b: Block): string {
  switch (b.type) {
    case "section":
    case "text":
    case "faq":
    case "cta":
      return b.html;
    case "form":
      return `${b.html}${b.note ?? ""}`;
    case "cards":
      return b.items.map((i) => `<h3>${i.title}</h3>${i.html}`).join("");
    default:
      return "";
  }
}
