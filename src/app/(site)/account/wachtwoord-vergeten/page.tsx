import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm, ResetForm } from "@/components/shop/AccountForms";
import { AuthCard } from "@/components/shop/AccountShell";
import { hashToken } from "@/lib/customer";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Wachtwoord vergeten", robots: { index: false, follow: true }, referrer: "no-referrer" };

export default async function ForgotPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const footer = (
    <Link href="/account/inloggen/" className="link font-semibold">
      Terug naar inloggen
    </Link>
  );

  if (token) {
    // Link uit de e-mail: alleen een geldig, niet-verlopen token geeft het formulier voor een nieuw wachtwoord
    const valid = /^[A-Za-z0-9_-]{20,100}$/.test(token) && !!(await db.customer.findFirst({ where: { resetToken: hashToken(token), resetExpires: { gt: new Date() } }, select: { id: true } }));
    return valid ? (
      <AuthCard title="Nieuw wachtwoord kiezen" intro="Kies een nieuw wachtwoord van minimaal 8 tekens. Daarna ben je direct ingelogd." footer={footer}>
        <ResetForm token={token} />
      </AuthCard>
    ) : (
      <AuthCard title="Deze link werkt niet meer" intro="De link is verlopen of al gebruikt. Vraag hieronder een nieuwe link aan." footer={footer}>
        <ForgotForm />
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Wachtwoord vergeten" intro="Vul je e-mailadres in. Je krijgt een e-mail met een link om een nieuw wachtwoord te kiezen." footer={footer}>
      <ForgotForm />
    </AuthCard>
  );
}
