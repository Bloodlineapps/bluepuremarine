import { PageHeader } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { FaqForm } from "../FaqForm";

export const metadata = { title: "Nieuwe vraag" };

export default async function NewFaq() {
  await requireUser();
  const cats = await db.faq.findMany({ where: { deletedAt: null }, distinct: ["category"], select: { category: true } });
  return (
    <>
      <PageHeader title="Nieuwe veelgestelde vraag" description="Komt onderaan de lijst; de volgorde wijzig je in het overzicht." />
      <FaqForm faq={null} categories={cats.map((c) => c.category)} />
    </>
  );
}
