import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddressForm } from "@/components/shop/AccountForms";
import { AccountShell } from "@/components/shop/AccountShell";
import { addressLines } from "@/components/shop/order-status";
import { requireCustomer } from "@/lib/customer";
import { db } from "@/lib/db";
import { getShop } from "@/lib/settings";
import { deleteAddress, setDefaultAddress } from "../actions";

export const metadata: Metadata = { title: "Mijn adressen", robots: { index: false, follow: true } };

const MESSAGES: Record<string, string> = {
  opgeslagen: "Het adres is opgeslagen.",
  verwijderd: "Het adres is verwijderd.",
  standaard: "Het standaardadres is gewijzigd.",
  vol: "Je kunt maximaal 20 adressen bewaren. Verwijder eerst een adres.",
};

export default async function AddressesPage({ searchParams }: { searchParams: Promise<{ melding?: string; nieuw?: string; wijzig?: string }> }) {
  const customer = await requireCustomer("/account/adressen/");
  const { melding, nieuw, wijzig } = await searchParams;
  const shop = await getShop();
  const countries = shop.shipping.map((s) => ({ value: s.country, label: s.label }));

  if (nieuw || wijzig) {
    const address = wijzig ? await db.address.findFirst({ where: { id: wijzig, customerId: customer.id } }) : null;
    if (wijzig && !address) notFound();
    const values: Record<string, string> = address
      ? { id: address.id, type: address.type, isDefault: address.isDefault ? "on" : "", firstName: address.firstName, lastName: address.lastName, company: address.company, country: address.country, postalCode: address.postalCode, houseNumber: address.houseNumber, addition: address.addition, street: address.street, city: address.city }
      : { firstName: customer.firstName, lastName: customer.lastName, type: nieuw === "factuur" ? "billing" : "shipping" };
    return (
      <AccountShell active="adressen" title={address ? "Adres wijzigen" : "Adres toevoegen"}>
        <div className="card max-w-2xl p-5 sm:p-6">
          <AddressForm address={values} countries={countries} />
        </div>
      </AccountShell>
    );
  }

  const addresses = await db.address.findMany({ where: { customerId: customer.id }, orderBy: [{ type: "desc" }, { isDefault: "desc" }, { createdAt: "desc" }] });
  const notice = melding ? MESSAGES[melding] : "";
  return (
    <AccountShell active="adressen" title="Mijn adressen" intro="Bewaar je bezorg- en factuuradressen, zodat afrekenen sneller gaat.">
      {notice && (
        <p role="status" className={`rounded-lg px-4 py-3 text-sm font-medium ${melding === "vol" ? "bg-coral-100 text-danger" : "bg-success-100 text-success"}`}>
          {notice}
        </p>
      )}
      <Link href="/account/adressen/?nieuw=1" className="btn-primary">
        Adres toevoegen
      </Link>
      {addresses.length === 0 ? (
        <p className="card p-6 text-sm text-ink-2">Je hebt nog geen adressen opgeslagen.</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className="card flex flex-col p-5">
              <p className="mb-2 flex flex-wrap items-center gap-2 text-sm font-bold text-ink">
                {a.type === "billing" ? "Factuuradres" : "Bezorgadres"}
                {a.isDefault && <span className="badge-stock">Standaard</span>}
              </p>
              <address className="flex-1 text-sm not-italic leading-relaxed text-ink-2">
                {addressLines(a).map((l) => (
                  <span key={l} className="block">
                    {l}
                  </span>
                ))}
              </address>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Link href={`/account/adressen/?wijzig=${a.id}`} className="btn-secondary btn-sm">
                  Wijzigen
                </Link>
                {!a.isDefault && (
                  <form action={setDefaultAddress}>
                    <input type="hidden" name="id" value={a.id} />
                    <button type="submit" className="btn-ghost btn-sm">
                      Maak standaard
                    </button>
                  </form>
                )}
                <form action={deleteAddress}>
                  <input type="hidden" name="id" value={a.id} />
                  <button type="submit" className="btn-ghost btn-sm !text-danger hover:!bg-coral-100" aria-label={`Verwijder adres ${a.street} ${a.houseNumber}`}>
                    Verwijderen
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AccountShell>
  );
}
