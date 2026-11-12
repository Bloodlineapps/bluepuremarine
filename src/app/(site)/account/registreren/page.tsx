import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/shop/AccountForms";
import { AuthCard } from "@/components/shop/AccountShell";
import { currentCustomer, safeReturn } from "@/lib/customer";

export const metadata: Metadata = { title: "Account aanmaken", robots: { index: false, follow: true } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ terug?: string }> }) {
  const { terug } = await searchParams;
  const back = safeReturn(terug);
  if (await currentCustomer()) redirect(back);
  return (
    <AuthCard
      title="Account aanmaken"
      intro="Met een account volg je je bestellingen, bewaar je je adressen en reken je de volgende keer sneller af."
      footer={
        <>
          Heb je al een account?{" "}
          <Link href={`/account/inloggen/${terug ? `?terug=${encodeURIComponent(back)}` : ""}`} className="link font-semibold">
            Inloggen
          </Link>
        </>
      }
    >
      <RegisterForm terug={back} />
    </AuthCard>
  );
}
