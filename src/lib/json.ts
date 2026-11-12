// JSON-velden worden als tekst opgeslagen (werkt op SQLite én PostgreSQL). Deze helpers lezen ze veilig uit.

export function parse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export type ImageRef = { src: string; alt: string };
export type Faq = { q: string; a: string };
export type Attributes = Record<string, string[]>;
export type TryOnSpot = { x: number; y: number; size: number };

export const images = (v: string | null | undefined) => parse<ImageRef[]>(v, []);
export const faqs = (v: string | null | undefined) => parse<Faq[]>(v, []);
export const attributes = (v: string | null | undefined) => parse<Attributes>(v, {});
export const strings = (v: string | null | undefined) => parse<string[]>(v, []);
