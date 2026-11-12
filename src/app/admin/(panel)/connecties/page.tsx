import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export default async function Connections() {
  await requireUser("admin");
  redirect("/admin/connecties/google/");
}
