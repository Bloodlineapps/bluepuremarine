import { PageHeader } from "@/components/admin/ui";
import { aiEnabled } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PostForm } from "../PostForm";

export const metadata = { title: "Nieuw artikel" };

export default async function NewPost() {
  await requireUser("user");
  const categories = await db.blogCategory.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <>
      <PageHeader title="Nieuw artikel" description="Een nieuw artikel begint als concept. Kies Gepland met een datum in de toekomst om het later automatisch te laten verschijnen." />
      <PostForm post={null} categories={categories} aiEnabled={await aiEnabled()} />
    </>
  );
}
