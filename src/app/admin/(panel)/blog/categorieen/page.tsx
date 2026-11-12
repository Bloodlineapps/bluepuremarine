import Link from "next/link";
import { deleteBlogCategory, saveBlogCategory } from "@/app/admin/actions/blog";
import { SimpleForm } from "@/components/admin/SimpleForm";
import { DeleteButton } from "@/components/admin/fields";
import { Field, PageHeader, Panel, btnSm, input } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = { title: "Blogcategorieën" };

export default async function BlogCategoriesPage() {
  await requireUser("user");
  const cats = await db.blogCategory.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { posts: { where: { deletedAt: null } } } } } });
  return (
    <>
      <PageHeader
        title="Blogcategorieën"
        description="Onderwerpen waarop bezoekers het blog kunnen filteren. Kies de categorie van een artikel in het blogformulier."
        action={
          <Link href="/admin/blog/" className={btnSm}>
            Terug naar het blog
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Panel title={`Categorieën (${cats.length})`}>
          {cats.length ? (
            <ul className="divide-y divide-line">
              {cats.map((c) => (
                <li key={c.id} className="flex flex-wrap items-start gap-4 py-4 first:pt-0 last:pb-0">
                  <SimpleForm action={saveBlogCategory.bind(null, c.id)} className="min-w-[260px] flex-1">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Naam">
                        <input name="name" defaultValue={c.name} required className={input} />
                      </Field>
                      <Field label="Slug">
                        <input name="slug" defaultValue={c.slug} className={`${input} font-mono`} />
                      </Field>
                    </div>
                  </SimpleForm>
                  <div className="w-44 space-y-2 pt-6 text-sm">
                    <Link href={`/admin/blog/?categorie=${c.id}`} className="block underline">
                      {c._count.posts} {c._count.posts === 1 ? "artikel" : "artikelen"}
                    </Link>
                    <DeleteButton action={deleteBlogCategory.bind(null, c.id)} confirmText={`Blogcategorie "${c.name}" verwijderen? De artikelen blijven bestaan, zonder categorie.`} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">Nog geen blogcategorieën. Voeg er hiernaast een toe.</p>
          )}
        </Panel>
        <Panel title="Nieuwe categorie">
          <SimpleForm action={saveBlogCategory.bind(null, null)} submitLabel="Toevoegen" resetOnSuccess>
            <Field label="Naam">
              <input name="name" required className={input} />
            </Field>
            <Field label="Slug" hint="(leeg = automatisch uit de naam)">
              <input name="slug" className={`${input} font-mono`} />
            </Field>
          </SimpleForm>
        </Panel>
      </div>
    </>
  );
}
