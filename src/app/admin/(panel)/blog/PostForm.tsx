"use client";
import { useState } from "react";
import type { Post } from "@prisma/client";
import { savePost, suggestPostMeta } from "@/app/admin/actions/blog";
import { AdminForm, ImageField, RichText, SeoFields } from "@/components/admin/fields";
import { postState } from "@/components/admin/shop/format";
import { Field, Panel, input } from "@/components/admin/ui";

const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const tagsOf = (json: string | undefined) => {
  try {
    const v = JSON.parse(json || "[]") as unknown;
    return Array.isArray(v) ? v.map(String).join(", ") : "";
  } catch {
    return "";
  }
};

/** Blogformulier: inhoud, uitgelichte afbeelding, categorie en tags, SEO, en publiceren (concept, gepland of gepubliceerd). */
export function PostForm({ post: p, categories, aiEnabled }: { post: Post | null; categories: { id: string; name: string }[]; aiEnabled: boolean }) {
  const [slug, setSlug] = useState(p?.slug ?? "");
  const [status, setStatus] = useState(p ? postState(p) : "draft");
  return (
    <AdminForm
      action={savePost.bind(null, p?.id ?? null)}
      aside={
        <>
          <Panel title="Publicatie">
            <div className="space-y-3">
              <Field label="Status">
                <select name="status" value={status} onChange={(e) => setStatus(e.target.value)} className={input}>
                  <option value="draft">Concept (niet zichtbaar)</option>
                  <option value="scheduled">Gepland (verschijnt op de publicatiedatum)</option>
                  <option value="published">Gepubliceerd</option>
                </select>
              </Field>
              <Field label="Publicatiedatum" hint={status === "scheduled" ? "(kies een moment in de toekomst)" : "(leeg = nu)"}>
                <input type="datetime-local" name="publishedAt" defaultValue={p ? local(p.publishedAt) : ""} required={status === "scheduled"} className={input} />
              </Field>
              <Field label="Auteur">
                <input name="authorName" defaultValue={p?.authorName ?? "BluePure Marine"} className={input} />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="noindex" defaultChecked={p?.noindex ?? false} /> Niet indexeren (noindex)
              </label>
            </div>
          </Panel>
          <Panel title="Categorie en tags">
            <div className="space-y-3">
              <Field label="Categorie">
                <select name="categoryId" defaultValue={p?.categoryId ?? ""} className={input}>
                  <option value="">Geen categorie</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Of maak een nieuwe categorie" hint="(vul de naam in; die wordt dan gekozen)">
                <input name="newCategory" className={input} />
              </Field>
              <Field label="Tags" hint="(gescheiden door komma's, bv. winterstalling, reinigen)">
                <input name="tags" defaultValue={tagsOf(p?.tags)} className={input} />
              </Field>
            </div>
          </Panel>
        </>
      }
    >
      <Panel title="Artikel">
        <div className="space-y-4">
          <Field label="Titel (H1)">
            <input name="title" defaultValue={p?.title ?? ""} required className={input} />
          </Field>
          <Field label="Slug" hint={`(de URL wordt /blog/${slug || "…"}/ — leeg = automatisch uit de titel; wijzigen maakt automatisch een 301-redirect)`}>
            <input name="slug" value={slug} onChange={(e) => setSlug(e.target.value)} className={`${input} font-mono`} />
          </Field>
          <input type="hidden" name="path" value={`/blog/${slug || "…"}/`} />
          <Field label="Samenvatting" hint="(korte intro in het blogoverzicht en bovenaan het artikel)">
            <textarea name="excerpt" defaultValue={p?.excerpt ?? ""} rows={3} className={input} />
          </Field>
          <div>
            <span className="mb-1.5 block text-xs font-medium text-ink-soft">Inhoud (gebruik koppen H2/H3, lijsten, links naar producten en afbeeldingen)</span>
            <RichText name="content" value={p?.content ?? ""} minHeight={420} />
          </div>
        </div>
      </Panel>
      <Panel title="Uitgelichte afbeelding">
        <ImageField name="image" altName="imageAlt" value={p?.image} alt={p?.imageAlt} label="Afbeelding bovenaan het artikel en in het overzicht (alt-tekst verplicht)" />
      </Panel>
      <Panel title="Zoekmachines (SEO)">
        <SeoFields metaTitle={p?.metaTitle} metaDescription={p?.metaDescription} aiAction={suggestPostMeta} aiEnabled={aiEnabled} path={p?.path} />
      </Panel>
    </AdminForm>
  );
}
