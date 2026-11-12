import fs from "node:fs/promises";
import path from "node:path";
import { currentUser } from "@/lib/auth";

// Download van bijlagen uit formulieren. Staan buiten de publieke map; alleen voor ingelogde medewerkers.
const ROOT = path.join(process.cwd(), "storage", "forms");
const TYPES: Record<string, string> = { pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };

export async function GET(_: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (!(await currentUser())) return new Response("Niet ingelogd", { status: 401 });
  const parts = (await params).path.map(decodeURIComponent);
  const file = path.join(ROOT, ...parts);
  if (!file.startsWith(ROOT + path.sep) || parts.some((p) => p.includes(".."))) return new Response("Ongeldig pad", { status: 400 });
  try {
    const buf = await fs.readFile(file);
    const ext = path.extname(file).slice(1).toLowerCase();
    const name = path.basename(file).replace(/^[0-9a-f]{8}-/, "");
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": TYPES[ext] ?? "application/octet-stream", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  } catch {
    return new Response("Niet gevonden", { status: 404 });
  }
}
