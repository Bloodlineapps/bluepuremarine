import { PageHeader } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ReviewForm } from "../ReviewForm";

export const metadata = { title: "Review toevoegen" };

export default async function NewReview() {
  await requireUser("user");
  const products = await db.product.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <>
      <PageHeader title="Review toevoegen" description="Voeg alleen echte reviews toe die je van een klant hebt ontvangen, bijvoorbeeld per e-mail of via Google." />
      <ReviewForm review={null} products={products} />
    </>
  );
}
