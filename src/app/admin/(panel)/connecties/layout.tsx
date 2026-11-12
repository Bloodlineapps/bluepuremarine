import { ConnectionTabs } from "@/components/admin/ConnectionTabs";
import { PageHeader } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";

// Subtabjes met elk een eigen URL. Nieuwe koppelingen: voeg een tab toe in ConnectionTabs en een map hier.
// Alleen voor Beheerder en Superadmin: een Gebruiker wordt teruggestuurd naar het dashboard (elke pagina hieronder
// controleert dat zelf ook, en elke connectie-actie controleert het opnieuw op de server).
export default async function ConnectionsLayout({ children }: { children: React.ReactNode }) {
  await requireUser("admin");
  return (
    <>
      <PageHeader title="Connecties" description="Koppelingen met externe diensten. Sleutels worden versleuteld opgeslagen, alleen op de server gebruikt en na opslaan nooit meer volledig getoond. Elke wijziging komt in het logboek." />
      <ConnectionTabs />
      <div className="mt-6 space-y-6">{children}</div>
    </>
  );
}
