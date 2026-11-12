import { NextResponse } from "next/server";
import { PRODUCT_FILTERS, filtersFromUrl, productWhere, productsCsv } from "@/components/admin/shop/queries";
import { audit } from "@/lib/admin/audit";
import { currentUser } from "@/lib/auth";

// Producten als CSV (puntkomma, UTF-8 met BOM). GET = alle producten of het filter van het overzicht
// (?q=&status=&merk=&categorie=&voorraad=); POST met ids = alleen de selectie uit de bulkbalk.
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  const { q, filters } = filtersFromUrl(new URL(req.url), PRODUCT_FILTERS);
  await audit(user, "geëxporteerd", "Product", null, "Producten geëxporteerd als CSV");
  return productsCsv(await productWhere(q, filters));
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  const ids = (await req.formData()).getAll("ids").map(String);
  await audit(user, "geëxporteerd", "Product", null, `${ids.length} producten geëxporteerd als CSV`);
  return productsCsv({ id: { in: ids }, deletedAt: null });
}
