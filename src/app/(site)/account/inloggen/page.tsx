import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/shop/AccountForms";
import { AuthCard } from "@/components/shop/AccountShell";
import { currentCustomer, safeReturn } from "@/lib/customer";

export const metadata: Metadata = { title: "Inloggen", robots: { index: false, follow: true } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ terug?: string; uit?: string }> }) {
  const { terug, uit } = await searchParams;
  const back = safeReturn(terug);
  if (await currentCustomer()) redirect(back);
  return (
    <AuthCard
      title="Inloggen"
      intro="Log in om je bestellingen te bekijken en sneller af te rekenen."
      footer={
        <>
          Nog geen account?{" "}
          <Link href={`/account/registreren/${terug ? `?terug=${encodeURIComponent(back)}` : ""}`} className="link font-semibold">
            Maak een account aan
          </Link>
        </>
      }
    >
      {uit && (
        <p role="status" className="mb-4 rounded-lg bg-success-100 px-4 py-3 text-sm font-medium text-success">
          Je bent uitgelogd.
        </p>
      )}
      <LoginForm terug={back} />
    </AuthCard>
  );
}
