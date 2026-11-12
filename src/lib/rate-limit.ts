import "server-only";
import { headers } from "next/headers";

// Eenvoudige rate limit per IP in het geheugen (per serverinstantie). Genoeg tegen spam en misbruik van formulieren.
const hits = new Map<string, number[]>();

export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "local";
}

export async function rateLimit(bucket: string, max: number, windowMs: number) {
  const key = `${bucket}:${await clientIp()}`;
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) return false;
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return true;
}
