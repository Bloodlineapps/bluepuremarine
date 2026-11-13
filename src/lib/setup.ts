import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "./db";

// Eenmalige setup-link voor de eerste superadmin op een nieuwe omgeving (bv. productie op Replit), zonder terminal:
//   /admin/setup/?token=<waarde van de secret SETUP_TOKEN>
// De link werkt alleen als SETUP_TOKEN is ingesteld (minimaal 24 tekens) en die waarde nog niet eerder is gebruikt.
// Na gebruik wordt de hash van het token in de database bewaard: dezelfde link werkt daarna nooit meer. Een nieuwe
// waarde voor SETUP_TOKEN geeft opnieuw één keer toegang (bv. als het wachtwoord kwijt is). Zonder secret bestaat
// de pagina niet (404).
const USED_KEY = "setup.used";
const MIN_LENGTH = 24;

const sha = (s: string) => createHash("sha256").update(s).digest();

export async function setupTokenValid(token: string | undefined | null): Promise<boolean> {
  const expected = process.env.SETUP_TOKEN ?? "";
  if (expected.length < MIN_LENGTH || !token) return false;
  const given = sha(token);
  if (!timingSafeEqual(given, sha(expected))) return false;
  const used = await db.setting.findUnique({ where: { key: USED_KEY } });
  return used?.value !== given.toString("hex");
}

/** Markeert het token als gebruikt; daarna geeft setupTokenValid voor dit token altijd false. */
export async function burnSetupToken(token: string) {
  const value = sha(token).toString("hex");
  await db.setting.upsert({ where: { key: USED_KEY }, create: { key: USED_KEY, value }, update: { value } });
}
