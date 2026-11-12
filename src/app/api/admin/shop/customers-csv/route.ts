import { NextResponse } from "next/server";
import { CUSTOMER_FILTERS, customerWhere, customersCsv, filtersFromUrl } from "@/components/admin/shop/queries";
import { audit } from "@/lib/admin/audit";
import { currentUser } from "@/lib/auth";

// Klanten als CSV (zonder wachtwoorden). GET = alles of het filter van het overzicht; POST met ids = de selectie.
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  const { q, filters } = filtersFromUrl(new URL(req.url), CUSTOMER_FILTERS);
  await audit(user, "geëxporteerd", "Klant", null, "Klanten geëxporteerd als CSV");
  return customersCsv(customerWhere(q, filters));
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  const ids = (await req.formData()).getAll("ids").map(String);
  await audit(user, "geëxporteerd", "Klant", null, `${ids.length} klanten geëxporteerd als CSV`);
  return customersCsv({ id: { in: ids } });
}
