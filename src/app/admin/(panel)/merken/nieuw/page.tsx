import { PageHeader } from "@/components/admin/ui";
import { aiEnabled } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { BrandForm } from "../BrandForm";

export const metadata = { title: "Nieuw merk" };

export default async function NewBrand() {
  await requireUser("user");
  return (
    <>
      <PageHeader title="Nieuw merk" description="Koppel daarna producten aan het merk via het productformulier (Indeling)." />
      <BrandForm brand={null} aiEnabled={await aiEnabled()} />
    </>
  );
}
