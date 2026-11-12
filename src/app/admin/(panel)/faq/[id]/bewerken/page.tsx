import Link from "next/link";
import { notFound } from "next/navigation";
import { EditExtras } from "@/components/admin/EditExtras";
import { Notice, PageHeader, btnSm } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { FaqForm } from "../../FaqForm";

export const metadata = { title: "Vraag bewerken" };

export default async function EditFaq({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const [f, cats] = await Promise.all([db.faq.findUnique({ where: { id } }), db.faq.findMany({ where: { deletedAt: null }, distinct: ["category"], select: { category: true } })]);
  if (!f || f.deletedAt) notFound();
  return (
    <>
      <PageHeader
        title={f.question}
        description="Veelgestelde vraag"
        action={
          <Link href="/veelgestelde-vragen/" target="_blank" className={btnSm}>
            Bekijk op de site ↗
          </Link>
        }
      />
      {sp.nieuw && <Notice>Vraag aangemaakt.</Notice>}
      {sp.teruggezet && <Notice>De eerdere versie is teruggezet.</Notice>}
      <FaqForm faq={f} categories={cats.map((c) => c.category)} />
      <EditExtras entity="faq" id={f.id} canEdit />
    </>
  );
}
