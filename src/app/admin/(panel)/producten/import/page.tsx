import Link from "next/link";
import { previewProductImport, runProductImport } from "@/app/admin/actions/shop";
import { ProductImport } from "@/components/admin/shop/ProductImport";
import { PRODUCT_CSV_HEADER } from "@/components/admin/shop/queries";
import { PageHeader, Panel, btnSm } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Producten importeren" };

export default async function ImportProducts() {
  await requireUser("user");
  return (
    <>
      <PageHeader
        title="Producten importeren"
        description="Werk prijzen, voorraad en andere gegevens in één keer bij met een CSV-bestand, of maak nieuwe producten aan."
        action={
          <>
            <a href="/api/admin/shop/products-csv/" className={btnSm}>
              Download huidige producten (CSV)
            </a>
            <Link href="/admin/producten/" className={btnSm}>
              Terug naar producten
            </Link>
          </>
        }
      />
      <ProductImport preview={previewProductImport} run={runProductImport} />
      <Panel title="Zo werkt het" className="mt-6">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
          <li>Begin het makkelijkst met de export: pas die aan in Excel en sla hem op als CSV (puntkomma als scheidingsteken, UTF-8).</li>
          <li>
            Een regel wordt gekoppeld aan een bestaand product op <strong>slug</strong> en anders op <strong>SKU</strong>. Geen match = nieuw product (naam en prijs zijn dan verplicht; het wordt een concept tenzij de kolom status is ingevuld).
          </li>
          <li>Alleen kolommen die in het bestand staan worden aangepast. Een lege cel bij naam, prijs, btw, voorraad, status, gewicht of categoriepaden laat de bestaande waarde staan; bij de andere kolommen maakt een lege cel het veld leeg.</li>
          <li>Prijzen in euro&apos;s (24,95), gewicht in gram, btw 21, 9 of 0, status published of draft.</li>
          <li>Categoriepaden gescheiden door een verticale streep, bijvoorbeeld /onderhoud/reinigingsproducten/|/bestsellers/. Het eerste pad wordt de hoofdcategorie. Onbekende paden geven een fout.</li>
          <li>Een merk dat nog niet bestaat wordt automatisch aangemaakt. Bij producten met varianten worden prijs en voorraad niet aangepast.</li>
        </ul>
        <p className="mt-4 text-xs text-ink-soft">
          Kolommen: <span className="font-mono">{PRODUCT_CSV_HEADER.join("; ")}</span>
        </p>
      </Panel>
    </>
  );
}
