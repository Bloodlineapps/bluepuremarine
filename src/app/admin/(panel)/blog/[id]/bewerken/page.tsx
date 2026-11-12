import Link from "next/link";
import { notFound } from "next/navigation";
import { EditExtras } from "@/components/admin/EditExtras";
import { POST_STATUS, postState } from "@/components/admin/shop/format";
import { Badge, Notice, PageHeader, btnSm, fmtDateTime } from "@/components/admin/ui";
import { aiEnabled } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PostForm } from "../../PostForm";

export const metadata = { title: "Artikel bewerken" };

export default async function EditPost({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  await requireUser("user");
  const { id } = await params;
  const sp = await searchParams;
  const [p, categories] = await Promise.all([db.post.findUnique({ where: { id } }), db.blogCategory.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })]);
  if (!p || p.deletedAt) notFound();
  const state = postState(p);
  return (
    <>
      <PageHeader
        title={p.title}
        description={<span className="font-mono">{p.path}</span>}
        action={
          state === "published" ? (
            <Link href={p.path} target="_blank" className={btnSm}>
              Bekijk op de site ↗
            </Link>
          ) : (
            <Badge tone={POST_STATUS[state].tone}>{state === "scheduled" ? `Gepland: verschijnt op ${fmtDateTime(p.publishedAt)}` : "Concept: niet zichtbaar op de site"}</Badge>
          )
        }
      />
      {sp.nieuw && <Notice>Artikel aangemaakt.</Notice>}
      {sp.teruggezet && <Notice>De eerdere versie is teruggezet.</Notice>}
      <PostForm post={p} categories={categories} aiEnabled={await aiEnabled()} />
      <EditExtras entity="post" id={p.id} canEdit />
    </>
  );
}
