import fs from "node:fs/promises";
import path from "node:path";

// Browsers vragen altijd /favicon.ico op; we leveren het PNG-icoon (wordt door alle browsers geaccepteerd).
export async function GET() {
  const buf = await fs.readFile(path.join(process.cwd(), "public", "apple-touch-icon.png"));
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=604800" } });
}
