import type { Metadata } from "next";
import { DetailsForm, EmailForm, PasswordForm } from "@/components/shop/AccountForms";
import { AccountShell } from "@/components/shop/AccountShell";
import { requireCustomer } from "@/lib/customer";

export const metadata: Metadata = { title: "Mijn gegevens", robots: { index: false, follow: true } };

export default async function DetailsPage() {
  const customer = await requireCustomer("/account/gegevens/");
  return (
    <AccountShell active="gegevens" title="Mijn gegevens" intro="Wijzig je naam, telefoonnummer, e-mailadres of wachtwoord.">
      <section className="card max-w-2xl p-5 sm:p-6">
        <h2 className="mb-4 text-xl">Persoonlijke gegevens</h2>
        <DetailsForm customer={{ firstName: customer.firstName, lastName: customer.lastName, phone: customer.phone, newsletter: customer.newsletter }} />
      </section>
      <section className="card max-w-2xl p-5 sm:p-6">
        <h2 className="mb-1 text-xl">E-mailadres</h2>
        <p className="mb-4 text-sm text-muted">
          Je logt in met <strong className="text-ink">{customer.email}</strong>.
        </p>
        <EmailForm email={customer.email} />
      </section>
      <section className="card max-w-2xl p-5 sm:p-6">
        <h2 className="mb-4 text-xl">Wachtwoord wijzigen</h2>
        <PasswordForm />
      </section>
    </AccountShell>
  );
}
