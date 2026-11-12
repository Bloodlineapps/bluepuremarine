import { NextResponse } from "next/server";
import { ORDER_FILTERS, filtersFromUrl, orderWhere, ordersCsv } from "@/components/admin/shop/queries";
import { audit } from "@/lib/admin/audit";
import { currentUser } from "@/lib/auth";

// Bestellingen als CSV. GET = alles of het filter van het overzicht (?q=&status=&betaling=&periode=); POST met ids = de selectie.
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  const { q, filters } = filtersFromUrl(new URL(req.url), ORDER_FILTERS);
  await audit(user, "geëxporteerd", "Bestelling", null, "Bestellingen geëxporteerd als CSV");
  return ordersCsv(orderWhere(q, filters));
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  const ids = (await req.formData()).getAll("ids").map(String);
  await audit(user, "geëxporteerd", "Bestelling", null, `${ids.length} bestellingen geëxporteerd als CSV`);
  return ordersCsv({ id: { in: ids } });
}
