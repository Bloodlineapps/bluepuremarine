import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

// 404-log: de 404-pagina meldt hier (via sendBeacon) welk pad niet bestond en vanaf welke pagina de bezoeker kwam.
// Zo blijven de publieke routes statisch. Alleen paden van deze site, met een limiet tegen misbruik.
export async function POST(req: Request) {
  try {
    if (!(await rateLimit(`404:${req.headers.get("x-forwarded-for") ?? "local"}`, 30, 60_000))) return new Response(null, { status: 429 });
    const body = (await req.json()) as { path?: string; referrer?: string };
    const path = String(body.path ?? "");
    if (!/^\/[^\s]{0,299}$/.test(path) || path.startsWith("/admin") || path.startsWith("/api")) return new Response(null, { status: 400 });
    const referrer = body.referrer ? String(body.referrer).slice(0, 300) : null;
    await db.notFoundHit.upsert({ where: { path }, create: { path, referrer }, update: { hits: { increment: 1 }, lastAt: new Date(), ...(referrer ? { referrer } : {}) } });
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 204 });
  }
}
