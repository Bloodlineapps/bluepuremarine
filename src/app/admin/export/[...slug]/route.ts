import { audit } from "@/lib/admin/audit";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseSteps } from "@/lib/forms";
import { parse } from "@/lib/json";
import { SITE_URL } from "@/lib/settings";

// CSV-export voor het beheer (alleen ingelogd): /admin/export/paginas/, /admin/export/faq/, /admin/export/seo/ en
// /admin/export/inzendingen/<formulier-id>/. Puntkomma als scheidingsteken en een BOM, zodat Excel het direct goed opent.

type Cell = string | number | boolean | Date | null | undefined;

function csv(rows: Cell[][]) {
  const cell = (v: Cell) => {
    const s = v instanceof Date ? v.toISOString().slice(0, 16).replace("T", " ") : v == null ? "" : typeof v === "boolean" ? (v ? "ja" : "nee") : String(v);
    // formules onschadelijk maken (CSV-injectie) en aanhalingstekens verdubbelen
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return `﻿${rows.map((r) => r.map(cell).join(";")).join("\r\n")}\r\n`;
}

const file = (name: string, body: string) => new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

export async function GET(_: Request, { params }: { params: Promise<{ slug: string[] }> }) {
  const user = await currentUser();
  if (!user) return new Response("Niet ingelogd", { status: 401 });
  const [kind, id] = (await params).slug;
  const where = { deletedAt: null };

  if (kind === "paginas") {
    const rows = await db.page.findMany({ where, orderBy: { path: "asc" } });
    await audit(user, "geëxporteerd", "Pagina", null, `${rows.length} pagina's geëxporteerd (CSV)`);
    return file("paginas", csv([["URL", "Titel", "Onderdeel", "Type", "Status", "Noindex", "Meta-title", "Meta-description", "Gewijzigd"], ...rows.map((r) => [SITE_URL + r.path, r.title, r.section, r.template, r.status, r.noindex, r.metaTitle, r.metaDescription, r.updatedAt])]));
  }

  if (kind === "faq") {
    const rows = await db.faq.findMany({ where, orderBy: { sortOrder: "asc" } });
    await audit(user, "geëxporteerd", "Veelgestelde vraag", null, `${rows.length} veelgestelde vragen geëxporteerd (CSV)`);
    return file("veelgestelde-vragen", csv([["Volgorde", "Categorie", "Vraag", "Antwoord (HTML)", "Status", "Gewijzigd"], ...rows.map((r) => [r.sortOrder + 1, r.category, r.question, r.answer, r.status, r.updatedAt])]));
  }

  if (kind === "seo") {
    const sel = { path: true, status: true, noindex: true, metaTitle: true, metaDescription: true } as const;
    const [pages, products, categories, posts] = await Promise.all([
      db.page.findMany({ where, select: { ...sel, title: true } }),
      db.product.findMany({ where, select: { ...sel, name: true } }),
      db.category.findMany({ where, select: { ...sel, name: true } }),
      db.post.findMany({ where, select: { ...sel, title: true } }),
    ]);
    const all = [...pages.map((r) => ({ ...r, type: "Pagina" })), ...products.map((r) => ({ ...r, title: r.name, type: "Product" })), ...categories.map((r) => ({ ...r, title: r.name, type: "Categorie" })), ...posts.map((r) => ({ ...r, type: "Blog" }))].sort((a, b) => a.path.localeCompare(b.path));
    await audit(user, "geëxporteerd", "SEO", null, `Meta-gegevens van ${all.length} URL's geëxporteerd (CSV)`);
    return file("seo", csv([["URL", "Type", "Titel", "Status", "Noindex", "Meta-title", "Lengte title", "Meta-description", "Lengte description"], ...all.map((r) => [SITE_URL + r.path, r.type, r.title, r.status, r.noindex, r.metaTitle, r.metaTitle?.length ?? 0, r.metaDescription, r.metaDescription?.length ?? 0])]));
  }

  if (kind === "inzendingen" && id) {
    const form = await db.form.findUnique({ where: { id } });
    if (!form) return new Response("Niet gevonden", { status: 404 });
    const fields = parseSteps(form.steps).flatMap((s) => s.fields);
    const subs = await db.formSubmission.findMany({ where: { formId: id }, orderBy: { createdAt: "desc" } });
    await audit(user, "geëxporteerd", "Inzending", id, `${subs.length} inzendingen van ${form.name} geëxporteerd (CSV)`);
    return file(
      `inzendingen-${form.key}`,
      csv([
        ["Ontvangen", ...fields.map((f) => f.label), "Pagina", "Gelezen", "E-mailmelding"],
        ...subs.map((s) => {
          const data = parse<Record<string, string | string[]>>(s.data, {});
          const files = parse<{ field: string; name: string }[]>(s.files, []);
          return [
            s.createdAt,
            ...fields.map((f) =>
              f.type === "file"
                ? files
                    .filter((x) => x.field === f.id)
                    .map((x) => x.name)
                    .join(", ")
                : Array.isArray(data[f.id])
                  ? (data[f.id] as string[]).join(", ")
                  : (data[f.id] as string | undefined),
            ),
            s.sourcePath,
            s.read,
            s.mailStatus,
          ];
        }),
      ]),
    );
  }

  return new Response("Niet gevonden", { status: 404 });
}
