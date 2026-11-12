import { SubTabs } from "@/components/admin/SubTabs";
import { PageHeader } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";

const TABS = [
  { href: "/admin/instellingen/bedrijf/", label: "Bedrijf" },
  { href: "/admin/instellingen/webshop/", label: "Webshop" },
  { href: "/admin/instellingen/homepage/", label: "Homepage" },
  { href: "/admin/instellingen/reviews/", label: "Reviews" },
  { href: "/admin/instellingen/seo/", label: "SEO" },
];

// Subtabjes met elk een eigen URL (zelfde patroon als Connecties).
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <>
      <PageHeader title="Instellingen" description="Eén centrale plek voor bedrijfsgegevens, winkelinstellingen en de homepage. Header, footer, winkelwagen, e-mails, structured data en sitemap gebruiken deze waarden. Lege velden worden nergens getoond." />
      <SubTabs tabs={TABS} label="Instellingen" />
      <div className="mt-6 space-y-6">{children}</div>
    </>
  );
}
