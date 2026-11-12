import { productFormOptions } from "@/components/admin/shop/queries";
import { PageHeader } from "@/components/admin/ui";
import { aiEnabled } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { ProductForm } from "../ProductForm";

export const metadata = { title: "Nieuw product" };

export default async function NewProduct() {
  await requireUser("user");
  const opts = await productFormOptions();
  return (
    <>
      <PageHeader title="Nieuw product" description="Een nieuw product begint als concept. Zet de status op Gepubliceerd om het in de winkel te tonen. De URL wordt /producten/<slug>/." />
      <ProductForm product={null} brands={opts.brands} categories={opts.categories} types={opts.types} aiEnabled={await aiEnabled()} />
    </>
  );
}
