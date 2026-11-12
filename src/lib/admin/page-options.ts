import "server-only";
import { db } from "../db";

/** Keuzelijsten voor het paginaformulier: bovenliggende pagina's, formulieren en linksuggesties (pagina's en categorieën). */
export async function pageFormOptions() {
  const [pages, forms, categories] = await Promise.all([
    db.page.findMany({ where: { deletedAt: null }, orderBy: { sortOrder: "asc" }, select: { path: true, title: true, navTitle: true, translationKey: true } }),
    db.form.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { key: true, name: true } }),
    db.category.findMany({ where: { deletedAt: null }, orderBy: { path: "asc" }, select: { path: true, name: true } }),
  ]);
  return {
    parents: pages.filter((p) => p.translationKey).map((p) => ({ value: p.translationKey, label: `${p.navTitle || p.title} (${p.path})` })),
    forms: forms.map((f) => ({ value: f.key, label: f.name })),
    links: [
      ...pages.map((p) => ({ value: p.path, label: p.navTitle || p.title })),
      ...categories.map((c) => ({ value: c.path, label: `Categorie: ${c.name}` })),
      { value: "/merken/", label: "Merken" },
      { value: "/blog/", label: "Blog" },
    ],
  };
}
