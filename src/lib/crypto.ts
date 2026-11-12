import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// API-sleutels van connecties worden versleuteld opgeslagen (AES-256-GCM). De sleutel wordt afgeleid van
// ENCRYPTION_KEY (of AUTH_SECRET); wijzig je die, dan moeten opgeslagen API-sleutels opnieuw worden ingevoerd.
function key() {
  const secret = process.env.ENCRYPTION_KEY || process.env.AUTH_SECRET || "dev-only-secret-please-change-me-0123456789";
  return createHash("sha256").update(`pn-connections:${secret}`).digest();
}

export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}

export function decrypt(payload: string) {
  if (!payload) return "";
  try {
    const [iv, tag, data] = payload.split(".").map((p) => Buffer.from(p, "base64"));
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

/** sk-ant-api03-…4f2a → "sk-…4f2a" (nooit de volledige sleutel tonen). */
export function maskKey(k: string) {
  if (k.length < 10) return "…";
  return `…${k.slice(-4)}`;
}
