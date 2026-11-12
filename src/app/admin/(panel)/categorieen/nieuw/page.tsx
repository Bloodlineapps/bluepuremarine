import { PageHeader } from "@/components/admin/ui";
import { aiEnabled } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CategoryForm } from "../CategoryForm";

export const metadata = { title: "Nieuwe categorie" };

export default async function NewCategory({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireUser("user");
  const sp = await searchParams;
  const [parents, groups] = await Promise.all([
    db.category.findMany({ where: { deletedAt: null, parentId: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, path: true } }),
    db.category.findMany({ where: { deletedAt: null, NOT: { menuGroup: "" } }, distinct: ["menuGroup"], select: { menuGroup: true } }),
  ]);
  return (
    <>
      <PageHeader title="Nieuwe categorie" description="Kies een bovenliggende categorie voor een subcategorie, of laat die leeg voor een nieuwe hoofdcategorie in het menu." />
      <CategoryForm category={null} parents={parents} groups={groups.map((g) => g.menuGroup)} hasChildren={false} aiEnabled={await aiEnabled()} defaultParent={sp.onder} />
    </>
  );
}
