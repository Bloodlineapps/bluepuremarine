import "server-only";
import { RANK, type AdminUser } from "../auth";
import { db } from "../db";
import { ROLE_LABELS } from "./labels";

// Regels voor gebruikersbeheer (worden bij elke actie op de server gecontroleerd):
// - niemand kent een rol toe die hoger is dan zijn eigen rol;
// - niemand wijzigt of verwijdert een account met een hogere rol (dus alleen een superadmin beheert superadmins);
// - niemand verwijdert zichzelf;
// - de laatste superadmin kan niet verwijderd worden en zijn rol kan niet verlaagd worden.

export const rank = (key: string) => RANK[key] ?? 0;

/** De drie rollen bestaan altijd, met de namen uit het beheer; gesorteerd van laag naar hoog. */
export async function ensureRoles() {
  const existing = await db.role.findMany();
  for (const [key, name] of Object.entries(ROLE_LABELS)) {
    const row = existing.find((r) => r.key === key);
    if (!row) await db.role.create({ data: { key, name } });
    else if (row.name !== name) await db.role.update({ where: { id: row.id }, data: { name } });
  }
  return (await db.role.findMany()).filter((r) => r.key in RANK).sort((a, b) => rank(a.key) - rank(b.key));
}

export const superadminCount = () => db.user.count({ where: { role: { key: "superadmin" } } });

/** Mag `me` dit account wijzigen of verwijderen? Geeft een foutmelding of null. */
export function manageError(me: AdminUser, targetRole: string) {
  return rank(targetRole) > rank(me.role) ? "Je kunt een account met een hogere rol dan je eigen rol niet wijzigen of verwijderen." : null;
}

/** Mag `me` deze rol toekennen? Geeft een foutmelding of null. */
export function assignError(me: AdminUser, roleKey: string) {
  if (!(roleKey in RANK)) return "Onbekende rol.";
  return rank(roleKey) > rank(me.role) ? "Je kunt geen rol toekennen die hoger is dan je eigen rol." : null;
}

/** Controle vóór het wijzigen van de rol van een bestaand account. */
export async function roleChangeError(me: AdminUser, target: { id: string; role: { key: string } }, newRole: string) {
  const err = manageError(me, target.role.key) ?? assignError(me, newRole);
  if (err) return err;
  if (target.role.key === "superadmin" && newRole !== "superadmin" && (await superadminCount()) <= 1) return target.id === me.id ? "Je bent de laatste superadmin: je kunt je eigen rol niet verlagen." : "Dit is de laatste superadmin: de rol kan niet verlaagd worden.";
  return null;
}

/** Controle vóór het verwijderen van een account. */
export async function deleteError(me: AdminUser, target: { id: string; role: { key: string } }) {
  if (target.id === me.id) return "Je kunt jezelf niet verwijderen.";
  const err = manageError(me, target.role.key);
  if (err) return err;
  if (target.role.key === "superadmin" && (await superadminCount()) <= 1) return "De laatste superadmin kan niet verwijderd worden.";
  return null;
}
