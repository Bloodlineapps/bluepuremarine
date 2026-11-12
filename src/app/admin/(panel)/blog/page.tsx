import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { bulkPosts } from "@/app/admin/actions/blog";
import { DataTable, PER_PAGE, readParams, type Column } from "@/components/admin/DataTable";
import { ShopBulkBar } from "@/components/admin/shop/ShopBulkBar";
import { POST_STATUS, postState } from "@/components/admin/shop/format";
import { Badge, Notice, PageHeader, btnSm, fmtDate, fmtDateTime } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { like } from "@/lib/search";

export const metadata = { title: "Blog" };

const include = { category: { select: { name: true } } } satisfies Prisma.PostInclude;
type Row = Prisma.PostGetPayload<{ include: typeof include }>;

// Blogartikelen: zoeken, filteren op status en categorie, bulkacties. Gepland = gepubliceerd met een datum in de toekomst.
export default async function BlogPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireUser("user");
  const sp = await searchParams;
  // De site toont alleen status "published" met publishedAt <= nu. Een eventuele oude status "scheduled" zetten we
  // daarom om naar "published": de publicatiedatum bepaalt dan vanzelf wanneer het artikel verschijnt.
  await db.post.updateMany({ where: { status: "scheduled" }, data: { status: "published" } });
  const params = readParams(sp, { sort: "publishedAt", dir: "desc" }, ["status", "categorie"]);
  const now = new Date();
  const st = params.filters.status;
  const where: Prisma.PostWhereInput = {
    deletedAt: null,
    ...(params.q ? { OR: [{ title: like(params.q) }, { slug: like(params.q) }, { excerpt: like(params.q) }, { tags: like(params.q) }] } : {}),
    ...(st === "draft" ? { status: "draft" } : st === "scheduled" ? { status: "published", publishedAt: { gt: now } } : st === "published" ? { status: "published", publishedAt: { lte: now } } : {}),
    ...(params.filters.categorie === "geen" ? { categoryId: null } : params.filters.categorie ? { categoryId: params.filters.categorie } : {}),
  };
  const sort = ["title", "publishedAt", "updatedAt", "status"].includes(params.sort) ? params.sort : "publishedAt";
  const [rows, total, all, categories] = await Promise.all([
    db.post.findMany({ where, include, orderBy: [{ [sort]: params.dir }, { id: "asc" }], skip: (params.page - 1) * PER_PAGE, take: PER_PAGE }),
    db.post.count({ where }),
    db.post.findMany({ where, select: { id: true } }),
    db.blogCategory.findMany({ orderBy: { name: "asc" } }),
  ]);
  const cols: Column<Row>[] = [
    {
      key: "image",
      label: "Afbeelding",
      className: "w-20",
      render: (r) =>
        r.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.image} alt="" loading="lazy" className="h-11 w-16 rounded-lg object-cover" />
        ) : (
          <span className="grid h-11 w-16 place-items-center rounded-lg border border-dashed border-line text-[0.6rem] text-ink-soft">geen</span>
        ),
    },
    {
      key: "title",
      label: "Titel",
      sortable: true,
      render: (r) => (
        <div className="min-w-[220px]">
          <Link href={`/admin/blog/${r.id}/bewerken/`} className="font-medium hover:underline">
            {r.title}
          </Link>
          <a href={r.path} target="_blank" className="block font-mono text-xs text-ink-soft hover:underline">
            {r.path}
          </a>
        </div>
      ),
    },
    { key: "category", label: "Categorie", render: (r) => (r.category ? <Badge>{r.category.name}</Badge> : <span className="text-ink-soft">–</span>) },
    { key: "author", label: "Auteur", render: (r) => <span className="text-ink-soft">{r.authorName}</span> },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (r) => {
        const s = postState(r);
        return (
          <span className="flex flex-wrap gap-1">
            <Badge tone={POST_STATUS[s].tone}>{POST_STATUS[s].label}</Badge>
            {r.noindex && <Badge>noindex</Badge>}
          </span>
        );
      },
    },
    { key: "publishedAt", label: "Publicatiedatum", sortable: true, className: "whitespace-nowrap", render: (r) => (postState(r) === "scheduled" ? fmtDateTime(r.publishedAt) : fmtDate(r.publishedAt)) },
  ];
  return (
    <>
      <PageHeader
        title="Blog"
        description="Artikelen op /blog/. Een gepland artikel verschijnt automatisch op de gekozen publicatiedatum."
        action={
          <Link href="/admin/blog/categorieen/" className={btnSm}>
            Blogcategorieën beheren
          </Link>
        }
      />
      {sp.verwijderd && <Notice>Artikel naar de prullenbak verplaatst. Je kunt het 6 maanden herstellen.</Notice>}
      <ShopBulkBar
        formId="bulk-posts"
        action={bulkPosts}
        allIds={total > rows.length ? all.map((a) => a.id) : []}
        options={[
          { value: "publish", label: "Publiceren (nu)" },
          { value: "draft", label: "Naar concept", confirm: "{n} artikelen offline halen (concept)?" },
          { value: "trash", label: "Naar prullenbak", confirm: "{n} artikelen naar de prullenbak verplaatsen?" },
        ]}
      />
      <DataTable
        base="/admin/blog/"
        params={params}
        columns={cols}
        rows={rows}
        total={total}
        searchLabel="Zoek op titel, samenvatting of tag"
        selectForm="bulk-posts"
        filters={[
          { name: "status", label: "Status", options: Object.entries(POST_STATUS).map(([value, s]) => ({ value, label: s.label })) },
          { name: "categorie", label: "Categorie", options: [...categories.map((c) => ({ value: c.id, label: c.name })), { value: "geen", label: "Zonder categorie" }] },
        ]}
        newHref="/admin/blog/nieuw/"
        newLabel="Nieuw artikel"
      />
    </>
  );
}
