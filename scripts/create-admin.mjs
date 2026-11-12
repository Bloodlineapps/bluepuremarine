// Maakt een account voor het beheer aan (of zet een nieuw wachtwoord en een rol voor een bestaand account). Het
// wachtwoord typ je zelf in de terminal; het wordt niet getoond en alleen als bcrypt-hash opgeslagen.
// Gebruik: npm run user:admin -- naam@domein.nl "Volledige naam" [--role=user|admin|superadmin]
// Zonder --role wordt het account een superadmin.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const line of fs.existsSync(path.join(root, ".env")) ? fs.readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/) : []) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/.exec(line);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}

const ROLES = { user: "Gebruiker", admin: "Beheerder", superadmin: "Superadmin" };
const USAGE = 'Gebruik: npm run user:admin -- naam@domein.nl "Volledige naam" [--role=user|admin|superadmin]';
const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith("--"));
const [emailArg, nameArg] = args.filter((a) => !a.startsWith("--"));
const roleKey = (flags.find((f) => f.startsWith("--role="))?.slice(7) ?? "superadmin").toLowerCase();
const email = (emailArg ?? "").trim().toLowerCase();
const name = nameArg ?? email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
if (!/^\S+@\S+\.\S+$/.test(email)) {
  console.error(USAGE);
  process.exit(1);
}
if (!Object.hasOwn(ROLES, roleKey) || flags.some((f) => !f.startsWith("--role="))) {
  console.error(`Onbekende optie of rol. ${USAGE}`);
  process.exit(1);
}

/** Wachtwoord vragen zonder het op het scherm te tonen (werkt ook met invoer via een pipe). */
let buffered = "";
function askHidden(question) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(question);
    let value = "";
    const feed = (chunk) => {
      for (let i = 0; i < chunk.length; i++) {
        const ch = chunk[i];
        if (ch === "\r" || ch === "\n" || ch === "\u0004") {
          if (ch === "\r" && chunk[i + 1] === "\n") i++;
          buffered = chunk.slice(i + 1);
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.off("data", feed);
          process.stdout.write("\n");
          resolve(value);
          return true;
        } else if (ch === "\u0003") process.exit(130);
        else if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else value += ch;
      }
      return false;
    };
    if (buffered && feed(buffered)) return;
    buffered = "";
    stdin.setRawMode?.(true);
    stdin.setEncoding("utf8");
    stdin.on("data", feed);
    stdin.resume();
  });
}

const pass = await askHidden(`Nieuw wachtwoord voor ${email} (min. 12 tekens): `);
const again = await askHidden("Herhaal het wachtwoord: ");
if (pass.length < 12) {
  console.error("Het wachtwoord moet minimaal 12 tekens hebben.");
  process.exit(1);
}
if (pass !== again) {
  console.error("De wachtwoorden zijn niet gelijk.");
  process.exit(1);
}

const db = new PrismaClient();
// de drie rollen bestaan altijd, met de namen uit het beheer
for (const [key, label] of Object.entries(ROLES)) await db.role.upsert({ where: { key }, create: { key, name: label }, update: { name: label } });
const role = await db.role.findUniqueOrThrow({ where: { key: roleKey } });
const passwordHash = await bcrypt.hash(pass, 11);
const existing = await db.user.findUnique({ where: { email } });
const user = existing ? await db.user.update({ where: { email }, data: { passwordHash, roleId: role.id } }) : await db.user.create({ data: { email, name, passwordHash, roleId: role.id } });
await db.auditLog.create({ data: { userId: user.id, userName: "Terminal", action: existing ? "gewijzigd" : "aangemaakt", entity: "Gebruiker", entityId: user.id, summary: `${ROLES[roleKey]} ${email} ${existing ? "nieuw wachtwoord gegeven" : "aangemaakt"} via de terminal` } });
await db.$disconnect();
console.log(`${existing ? "Wachtwoord en rol bijgewerkt" : "Account aangemaakt"}: ${email} (${user.name}, rol ${ROLES[roleKey]}). Inloggen: ${(process.env.SITE_URL || "http://localhost:3700").replace(/\/$/, "")}/admin/`);
