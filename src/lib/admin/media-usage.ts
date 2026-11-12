import "server-only";
import { db } from "../db";

export type MediaUse = { label: string; href: string; detail?: string };

/**
 * Waar wordt een mediabestand gebruikt? Pagina's (hero, deelafbeelding, blokken), veelgestelde vragen, producten
 * (afbeeldingen, varianten, teksten), categorieën, merken, blogs en de actieblokken van de homepage.
 * Items in de prullenbak tellen mee: die kunnen nog hersteld worden.
 */
export async function mediaUsage(path: string): Promise<MediaUse[]> {
  const has = { contains: path };
  const [pages, faqs, products, variants, categories, brands, posts, home] = await Promise.all([
    db.page.findMany({ where: { OR: [{ heroImage: path }, { ogImage: path }, { blocks: has }] }, select: { id: true, title: true, path: true } }),
    db.faq.findMany({ where: { answer: has }, select: { id: true, question: true } }),
    db.product.findMany({ where: { OR: [{ images: has }, { description: has }, { usage: has }] }, select: { id: true, name: true, path: true } }),
    db.variant.findMany({ where: { image: path }, select: { name: true, product: { select: { id: true, name: true, path: true } } } }),
    db.category.findMany({ where: { OR: [{ image: path }, { description: has }] }, select: { id: true, name: true, path: true } }),
    db.brand.findMany({ where: { OR: [{ logo: path }, { description: has }] }, select: { id: true, name: true, slug: true } }),
    db.post.findMany({ where: { OR: [{ image: path }, { content: has }] }, select: { id: true, title: true, path: true } }),
    db.setting.findFirst({ where: { key: "home", value: has }, select: { key: true } }),
  ]);
  const seen = new Set(products.map((p) => p.id));
  return [
    ...pages.map((p) => ({ label: `Pagina: ${p.title}`, href: `/admin/paginas/${p.id}/bewerken/`, detail: p.path })),
    ...faqs.map((f) => ({ label: `Veelgestelde vraag: ${f.question}`, href: `/admin/faq/${f.id}/bewerken/` })),
    ...products.map((p) => ({ label: `Product: ${p.name}`, href: `/admin/producten/${p.id}/bewerken/`, detail: p.path })),
    ...variants.filter((v) => !seen.has(v.product.id) && seen.add(v.product.id)).map((v) => ({ label: `Product: ${v.product.name} (variant ${v.name})`, href: `/admin/producten/${v.product.id}/bewerken/`, detail: v.product.path })),
    ...categories.map((c) => ({ label: `Categorie: ${c.name}`, href: `/admin/categorieen/${c.id}/bewerken/`, detail: c.path })),
    ...brands.map((b) => ({ label: `Merk: ${b.name}`, href: "/admin/merken/", detail: `/merken/${b.slug}/` })),
    ...posts.map((p) => ({ label: `Blog: ${p.title}`, href: `/admin/blog/${p.id}/bewerken/`, detail: p.path })),
    ...(home ? [{ label: "Homepage: actieblokken", href: "/admin/instellingen/homepage/" }] : []),
  ];
}
