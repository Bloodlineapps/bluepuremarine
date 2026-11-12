import Link from "next/link";
import { notFound } from "next/navigation";
import { EditExtras } from "@/components/admin/EditExtras";
import { Notice, PageHeader, btnSm } from "@/components/admin/ui";
import { pageFormOptions } from "@/lib/admin/page-options";
import { aiEnabled } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageForm } from "../../PageForm";

export const metadata = { title: "Pagina bewerken" };

export default async function EditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const p = await db.page.findUnique({ where: { id } });
  if (!p || p.deletedAt) notFound();
  const opts = await pageFormOptions();
  return (
    <>
      <PageHeader
        title={p.title}
        description={<span className="font-mono">{p.path}</span>}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/voorbeeld/${p.id}/`} target="_blank" className={btnSm}>
              Voorbeeld ↗
            </Link>
            {p.status === "published" && (
              <Link href={p.path} target="_blank" className={btnSm}>
                Bekijk op de site ↗
              </Link>
            )}
          </div>
        }
      />
      {sp.nieuw && <Notice>Pagina aangemaakt.</Notice>}
      {sp.teruggezet && <Notice>De eerdere versie is teruggezet.</Notice>}
      {p.isDraftCopy && <Notice tone="warning">Concepttekst: deze pagina moet nog inhoudelijk (of juridisch) gecontroleerd worden.</Notice>}
      <PageForm page={p} aiEnabled={await aiEnabled()} parents={opts.parents} forms={opts.forms} links={opts.links} />
      <EditExtras entity="page" id={p.id} canEdit canTrash={p.path !== "/"} />
    </>
  );
}
