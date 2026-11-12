import { PageHeader } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";
import { DiscountForm } from "../DiscountForm";

export const metadata = { title: "Nieuwe kortingscode" };

export default async function NewDiscount() {
  await requireUser("user");
  return (
    <>
      <PageHeader title="Nieuwe kortingscode" description="De code werkt direct na het opslaan, tenzij je een startdatum kiest of Actief uitzet." />
      <DiscountForm discount={null} />
    </>
  );
}
