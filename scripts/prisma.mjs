// Prisma-wrapper: lokaal SQLite, op Netlify PostgreSQL — met één schema.
// Prisma kan de provider niet uit een env-variabele halen. Daarom: begint DATABASE_URL met postgres(ql)://,
// dan schrijven we prisma/schema.postgres.prisma (provider "postgresql", optioneel directUrl) en draaien
// we Prisma daarmee. Anders gebruikt Prisma gewoon prisma/schema.prisma (SQLite).
// Gebruik: node scripts/prisma.mjs <prisma-argumenten>   bv. `generate`, `db push`, `validate`
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// .env inlezen zonder extra dependency (bestaande env-variabelen, bv. op Netlify, gaan voor)
const envFile = path.join(root, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const url = process.env.DATABASE_URL ?? "";
const isPostgres = /^postgres(ql)?:\/\//.test(url);
const args = process.argv.slice(2);

let schemaArgs = [];
if (isPostgres) {
  const source = fs.readFileSync(path.join(root, "prisma", "schema.prisma"), "utf8");
  const directUrl = process.env.DIRECT_URL ? '\n  directUrl = env("DIRECT_URL")' : "";
  const pg = source.replace(/provider\s*=\s*"sqlite"\s*\n(\s*)url\s*=\s*env\("DATABASE_URL"\)/, `provider = "postgresql"\n$1url      = env("DATABASE_URL")${directUrl}`);
  if (pg === source) throw new Error("Kon de SQLite-datasource in prisma/schema.prisma niet omzetten");
  const target = path.join(root, "prisma", "schema.postgres.prisma");
  fs.writeFileSync(target, `// GEGENEREERD door scripts/prisma.mjs — niet bewerken, pas prisma/schema.prisma aan.\n${pg}`);
  schemaArgs = ["--schema", "prisma/schema.postgres.prisma"];
}

console.log(`[prisma] ${isPostgres ? "PostgreSQL" : "SQLite"} → prisma ${args.join(" ")}`);
const res = spawnSync("npx", ["prisma", ...args, ...schemaArgs], { stdio: "inherit", cwd: root, shell: true, env: process.env });
process.exit(res.status ?? 1);
