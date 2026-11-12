import "server-only";
import { db } from "../db";
import type { AdminUser } from "../auth";

/** Logboek: wie heeft wat wanneer aangemaakt, gewijzigd of verwijderd. */
export async function audit(user: AdminUser, action: "aangemaakt" | "gewijzigd" | "verwijderd" | "ingelogd" | "getest" | "geïmporteerd" | "geëxporteerd" | "verstuurd", entity: string, entityId: string | null, summary: string) {
  await db.auditLog.create({ data: { userId: user.id, userName: user.name, action, entity, entityId, summary: summary.slice(0, 300) } });
}
