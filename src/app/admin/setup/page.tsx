import { notFound } from "next/navigation";
import { setupTokenValid } from "@/lib/setup";
import { SetupForm } from "./SetupForm";

export const metadata = { title: "Eerste beheerder aanmaken", referrer: "no-referrer" as const };
export const dynamic = "force-dynamic";

// Eenmalige setup-link: /admin/setup/?token=<SETUP_TOKEN>. Zonder geldig, ongebruikt token bestaat deze pagina niet.
export default async function SetupPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!(await setupTokenValid(token))) notFound();
  return (
    <main className="grid min-h-dvh place-items-center bg-navy p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="BluePure Marine" className="h-14 w-auto" />
        <h1 className="mt-8 font-sans text-2xl font-semibold">Superadmin aanmaken</h1>
        <p className="mt-1 text-sm text-ink-soft">Deze link werkt één keer. Bestaat het e-mailadres al, dan krijgt dat account dit wachtwoord en de rol superadmin.</p>
        <SetupForm token={token!} />
      </div>
    </main>
  );
}
