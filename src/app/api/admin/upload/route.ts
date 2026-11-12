import { NextResponse } from "next/server";
import { audit } from "@/lib/admin/audit";
import { saveUpload } from "@/lib/admin/upload";
import { assertRole } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await assertRole("user");
    const form = await req.formData();
    const files = form.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
    const saved = [];
    for (const f of files) saved.push(await saveUpload(f, String(form.get("alt") ?? "")));
    if (saved.length) await audit(user, "aangemaakt", "Media", saved[0].id, `${saved.length} afbeelding(en) geüpload`);
    return NextResponse.json({ items: saved });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload mislukt" }, { status: 400 });
  }
}
