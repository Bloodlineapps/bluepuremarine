// Formulierbouwer: types en validatie. Wordt zowel in de browser (directe feedback per stap) als op de server
// (de echte controle bij versturen) gebruikt, dus geen server-only imports hier. Foutmeldingen komen uit
// src/i18n/nl.json → form.
import { dict, fmt, type Dict, type Locale } from "./i18n";

export const FIELD_TYPES = {
  text: "Tekst",
  email: "E-mail",
  tel: "Telefoon",
  number: "Nummer",
  textarea: "Tekstvak",
  select: "Keuzelijst",
  radio: "Keuzerondjes",
  checkbox: "Selectievakjes",
  date: "Datum",
  file: "Bestand",
} as const;
export type FieldType = keyof typeof FIELD_TYPES;

export type FormField = {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  help?: string;
  required?: boolean;
  options?: string[];
  min?: number | null;
  max?: number | null;
  /** extra controle (reguliere expressie) met eigen foutmelding */
  pattern?: string;
  patternMessage?: string;
  accept?: string;
  autocomplete?: string;
};
export type FormStep = { id: string; title: string; fields: FormField[] };

export const MAX_FILE_MB = 10;
export const ALLOWED_FILES = /\.(pdf|docx?|jpe?g|png)$/i;

export function parseSteps(json: string | null | undefined): FormStep[] {
  try {
    const v = JSON.parse(json || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

type Value = string | string[] | { name: string; size: number } | null;

/** Controleert één veld; geeft een foutmelding of null. */
export function validateField(f: FormField, value: Value, locale: Locale = "nl"): string | null {
  const m: Dict["form"] = dict(locale).form;
  const empty = value == null || (Array.isArray(value) ? value.length === 0 : typeof value === "string" ? value.trim() === "" : !value.name);
  if (empty) return f.required ? fmt(m.isRequired, { label: f.label.replace(/\s*\((optioneel|optional)\)/i, "") }) : null;
  if (f.type === "file") {
    const file = value as { name: string; size: number };
    if (!ALLOWED_FILES.test(file.name)) return m.fileType;
    if (file.size > MAX_FILE_MB * 1024 * 1024) return fmt(m.fileSize, { n: MAX_FILE_MB });
    return null;
  }
  const v = Array.isArray(value) ? value : String(value).trim();
  if (typeof v === "string") {
    if (v.length > 5000) return m.tooLong;
    if (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return m.invalidEmail;
    if (f.type === "tel" && !/^[+()\d\s-]{8,20}$/.test(v)) return m.invalidTel;
    if (f.type === "number") {
      const n = Number(v.replace(",", "."));
      if (!Number.isFinite(n)) return m.invalidNumber;
      if (f.min != null && n < f.min) return m.invalidNumber;
      if (f.max != null && n > f.max) return m.invalidNumber;
    }
    if (f.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return m.invalidDate;
    if ((f.type === "text" || f.type === "textarea") && f.min && v.length < f.min) return fmt(m.minChars, { n: f.min });
    if ((f.type === "text" || f.type === "textarea") && f.max && v.length > f.max) return fmt(m.maxChars, { n: f.max });
    if ((f.type === "select" || f.type === "radio") && f.options?.length && !f.options.includes(v)) return m.chooseOption;
    if (f.pattern) {
      try {
        if (!new RegExp(f.pattern).test(v)) return f.patternMessage || m.invalidValue;
      } catch {
        /* ongeldig patroon in het beheer: negeren */
      }
    }
  } else if (f.type === "checkbox" && f.options?.length && v.some((x) => !f.options!.includes(x))) return m.chooseOption;
  return null;
}

export const newId = (prefix = "f") => `${prefix}${Math.random().toString(36).slice(2, 8)}`;
