// CSV voor Excel (NL): puntkomma als scheidingsteken, UTF-8 met BOM, regels met CRLF.

type Cell = string | number | boolean | null | undefined;

function cell(v: Cell) {
  let s = v == null ? "" : typeof v === "boolean" ? (v ? "ja" : "nee") : String(v);
  // Formule-injectie voorkomen: tekst die als formule zou worden uitgevoerd krijgt een apostrof (getallen en telefoonnummers niet)
  if (/^[=@]/.test(s) || (/^[+-]/.test(s) && !/^[+-]?[\d\s.,()-]+$/.test(s))) s = `'${s}`;
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: Cell[][]) {
  return `﻿${[header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n")}\r\n`;
}

export function csvResponse(filename: string, csv: string) {
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" } });
}

/** Bestandsnaam met datum, bv. producten-2026-03-01.csv */
export const csvName = (base: string) => `${base}-${new Date().toISOString().slice(0, 10)}.csv`;

/** CSV inlezen: herkent puntkomma of komma, aanhalingstekens en regeleinden binnen een cel. Lege regels vervallen. */
export function parseCsv(text: string): string[][] {
  const s = text.replace(/^﻿/, "");
  const first = s.split(/\r?\n/, 1)[0] ?? "";
  const sep = (first.match(/;/g)?.length ?? 0) >= (first.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(cur);
      cur = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else cur += c;
  }
  if (cur || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

/** Bytes van een geüpload bestand naar tekst: UTF-8, of Windows-1252 als Excel het zo heeft opgeslagen. */
export function decodeCsv(buf: ArrayBuffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("windows-1252").decode(buf);
  }
}
