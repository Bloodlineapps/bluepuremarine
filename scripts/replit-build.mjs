// Build voor Replit (en elke andere Linux-host). Draait in deze volgorde:
//   1. Prisma-client genereren (PostgreSQL als DATABASE_URL met postgres:// begint, anders SQLite)
//   2. Databaseschema bijwerken (prisma db push; voegt tabellen/kolommen toe, verwijdert geen data)
//   3. Database vullen met de content uit content/*.json, ALLEEN als hij nog leeg is
//   4. next build (prerendert alle pagina's uit de database)
// Gebruik: npm run build:replit
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (!process.env.DATABASE_URL) {
  // Zonder database-secret toch een werkende site: een SQLite-bestand dat tijdens de build wordt gevuld.
  // Let op: op Autoscale gaan wijzigingen uit het beheer dan verloren bij een herstart. Gebruik PostgreSQL.
  process.env.DATABASE_URL = "file:./prod.db";
  console.warn("[build] Geen DATABASE_URL gevonden: SQLite (prisma/prod.db) wordt gebruikt. Koppel bij voorkeur een PostgreSQL-database.");
}

function run(label, cmd, args) {
  console.log(`\n[build] ${label}`);
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", env: process.env });
  if (r.status !== 0) {
    console.error(`[build] Mislukt: ${label}`);
    process.exit(r.status ?? 1);
  }
}

const node = process.execPath;
run("Prisma-client genereren", node, ["scripts/prisma.mjs", "generate"]);
run("Databaseschema bijwerken", node, ["scripts/prisma.mjs", "db", "push", "--skip-generate"]);
run("Database vullen (alleen als hij leeg is)", node, [path.join("node_modules", "tsx", "dist", "cli.mjs"), "prisma/seed.ts", "--if-empty"]);
// Prerenderen gebeurt in meerdere workers tegelijk; elke worker opent anders een volledige verbindingspool
// (CPU's × 2 + 1). Dat overschrijdt de verbindingslimiet van een gehoste PostgreSQL. Beperk de pool tijdens de build.
if (/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL) && !/connection_limit=/.test(process.env.DATABASE_URL)) {
  const sep = process.env.DATABASE_URL.includes("?") ? "&" : "?";
  process.env.DATABASE_URL = `${process.env.DATABASE_URL}${sep}connection_limit=3&pool_timeout=60`;
}
process.env.NEXT_BUILD_CPUS ||= "2";
run("Next.js productie-build", node, [path.join("node_modules", "next", "dist", "bin", "next"), "build"]);
console.log("\n[build] Klaar. Start met: npm start");
