// Zoekfilter dat op beide databases hoofdletterongevoelig is. SQLite (lokaal) doet dat vanzelf en kent de optie
// `mode` niet; PostgreSQL (productie) is standaard hoofdlettergevoelig en heeft mode: "insensitive" nodig.
const isPostgres = /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "");

export const like = (q: string) => (isPostgres ? { contains: q, mode: "insensitive" } : { contains: q }) as { contains: string };
