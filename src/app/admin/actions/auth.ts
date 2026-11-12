"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/admin/audit";
import { endSession, startSession, type RoleKey } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export async function login(_: { error?: string }, form: FormData): Promise<{ error?: string }> {
  if (!(await rateLimit("login", 8, 15 * 60 * 1000))) return { error: "Te veel pogingen. Probeer het over een kwartier opnieuw." };
  const parsed = z.object({ email: z.string().trim().toLowerCase().min(2).max(160), password: z.string().min(1) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Vul je gebruikersnaam of e-mailadres en wachtwoord in." };
  // Inloggen kan met het volledige e-mailadres of met de gebruikersnaam (het deel vóór de @, bv. "admin")
  const id = parsed.data.email;
  const user = id.includes("@")
    ? await db.user.findUnique({ where: { email: id }, include: { role: true } })
    : await db.user.findFirst({ where: { email: { startsWith: `${id}@` } }, include: { role: true } });
  // altijd hashen, ook als de gebruiker niet bestaat (geen timing-verschil)
  const ok = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? "$2a$11$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva");
  if (!user || !ok) return { error: "Onjuiste gebruikersnaam of wachtwoord." };
  await startSession({ sub: user.id, email: user.email, name: user.name, role: user.role.key });
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit({ id: user.id, email: user.email, name: user.name, role: user.role.key as RoleKey, roleName: user.role.name }, "ingelogd", "Gebruiker", user.id, `${user.name} is ingelogd`);
  const terug = String(form.get("terug") ?? "");
  redirect(terug.startsWith("/admin/") ? terug : "/admin/");
}

export async function logout() {
  await endSession();
  redirect("/admin/login/");
}
