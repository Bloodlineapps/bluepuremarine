// Productieserver starten (lokaal én op Replit): poort uit PORT (standaard 3800), luistert op alle interfaces
// zodat de health check van Replit de site bereikt. Gebruik: npm start
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = process.env.PORT || "3800";
// zelfde terugval als scripts/replit-build.mjs: zonder database-secret het SQLite-bestand uit de build
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = "file:./prod.db";
const bin = path.join(root, "node_modules", "next", "dist", "bin", "next");
console.log(`[start] next start op 0.0.0.0:${port}`);
const child = spawn(process.execPath, [bin, "start", "-H", "0.0.0.0", "-p", port], { cwd: root, stdio: "inherit", env: { ...process.env, NODE_ENV: "production" } });
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code) => process.exit(code ?? 0));
