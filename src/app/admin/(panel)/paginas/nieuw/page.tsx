import { PageHeader } from "@/components/admin/ui";
import { pageFormOptions } from "@/lib/admin/page-options";
import { aiEnabled } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { PageForm } from "../PageForm";

export const metadata = { title: "Nieuwe pagina" };

export default async function NewPage() {
  await requireUser();
  const opts = await pageFormOptions();
  return (
    <>
      <PageHeader title="Nieuwe pagina" description="Leeg URL-pad = automatisch op basis van de titel. Elke pagina krijgt vanzelf een kruimelpad, structured data en een plek in de sitemap." />
      <PageForm page={null} aiEnabled={await aiEnabled()} parents={opts.parents} forms={opts.forms} links={opts.links} />
    </>
  );
}
