import { NextResponse } from "next/server";
import { SUBSCRIBER_FILTERS, filtersFromUrl, subscriberWhere, subscribersCsv } from "@/components/admin/shop/queries";
import { audit } from "@/lib/admin/audit";
import { currentUser } from "@/lib/auth";

// Nieuwsbriefaanmeldingen als CSV. GET = alles of het filter van het overzicht; POST met ids = de selectie.
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  const { q, filters } = filtersFromUrl(new URL(req.url), SUBSCRIBER_FILTERS);
  await audit(user, "geëxporteerd", "Nieuwsbrief", null, "Nieuwsbriefaanmeldingen geëxporteerd als CSV");
  return subscribersCsv(subscriberWhere(q, filters));
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  const ids = (await req.formData()).getAll("ids").map(String);
  await audit(user, "geëxporteerd", "Nieuwsbrief", null, `${ids.length} aanmeldingen geëxporteerd als CSV`);
  return subscribersCsv({ id: { in: ids } });
}
