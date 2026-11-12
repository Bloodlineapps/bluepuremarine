import { resetMenus, saveMenus } from "@/app/admin/actions/menus";
import { MenuEditor } from "@/components/admin/MenuEditor";
import { ActionButton } from "@/components/admin/SimpleForm";
import { PageHeader } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMenus } from "@/lib/menu";

export const metadata = { title: "Menu's" };

export default async function MenusPage() {
  await requireUser();
  const [menus, pages] = await Promise.all([getMenus(), db.page.findMany({ where: { deletedAt: null }, orderBy: { sortOrder: "asc" }, select: { translationKey: true, title: true, navTitle: true, path: true, status: true } })]);
  return (
    <>
      <PageHeader title="Menu's" description="Het hoofdmenu en het footermenu. De categorieën van de webshop staan automatisch in het menu; hier beheer je de extra links erachter en de kolommen in de footer. Wijzigingen staan na opslaan direct op de website." action={<ActionButton action={resetMenus} label="Standaardmenu terugzetten" />} />
      <MenuEditor initial={menus.nl} pages={pages.filter((p) => p.translationKey).map((p) => ({ value: p.translationKey, label: `${p.navTitle || p.title} (${p.path})${p.status === "draft" ? " · concept" : ""}` }))} action={saveMenus} readOnly={false} />
    </>
  );
}
