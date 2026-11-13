"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { startSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { burnSetupToken, setupTokenValid } from "@/lib/setup";

const ROLES = { user: "Gebruiker", admin: "Beheerder", superadmin: "Superadmin" } as const;

const schema = z.object({
  token: z.string().min(1),
  email: z.string().trim().toLowerCase().email().max(160),
  name: z.string().trim().min(2).max(120),
  password: z.string().min(12).max(200),
  again: z.string(),
});

/** Eenmalige setup: maakt de superadmin aan (of geeft een bestaand account een nieuw wachtwoord en de rol superadmin). */
export async function setupSuperadmin(_: { error?: string }, form: FormData): Promise<{ error?: string }> {
  if (!(await rateLimit("setup", 8, 15 * 60 * 1000))) return { error: "Te veel pogingen. Probeer het over een kwartier opnieuw." };
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Vul een geldig e-mailadres, je naam en een wachtwoord van minimaal 12 tekens in." };
  const { token, email, name, password, again } = parsed.data;
  if (password !== again) return { error: "De wachtwoorden zijn niet gelijk." };
  if (!(await setupTokenValid(token))) return { error: "Deze setup-link is niet (meer) geldig." };

  // Eerst het token ongeldig maken: een tweede verzoek met dezelfde link komt hierna niet meer door de controle.
  await burnSetupToken(token);
  for (const [key, label] of Object.entries(ROLES)) await db.role.upsert({ where: { key }, create: { key, name: label }, update: {} });
  const role = await db.role.findUniqueOrThrow({ where: { key: "superadmin" } });
  const passwordHash = await bcrypt.hash(password, 11);
  const existing = await db.user.findUnique({ where: { email } });
  const user = existing
    ? await db.user.update({ where: { email }, data: { passwordHash, roleId: role.id, lastLoginAt: new Date() } })
    : await db.user.create({ data: { email, name, passwordHash, roleId: role.id, lastLoginAt: new Date() } });
  await db.auditLog.create({
    data: { userId: user.id, userName: "Setup-link", action: existing ? "gewijzigd" : "aangemaakt", entity: "Gebruiker", entityId: user.id, summary: `Superadmin ${email} ${existing ? "nieuw wachtwoord gegeven" : "aangemaakt"} via de eenmalige setup-link` },
  });
  await startSession({ sub: user.id, email: user.email, name: user.name, role: role.key });
  redirect("/admin/");
}
