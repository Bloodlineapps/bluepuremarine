import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { like } from "@/lib/search";

// Mediakiezer in de editors: zoeken op bestandsnaam of alt-tekst.
export async function GET(req: Request) {
  if (!(await currentUser())) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const page = Math.max(1, Number(url.searchParams.get("pagina")) || 1);
  const where = q ? { OR: [{ path: like(q) }, { alt: like(q) }] } : {};
  const [items, total] = await Promise.all([db.media.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 48, take: 48 }), db.media.count({ where })]);
  return NextResponse.json({ items, total });
}
