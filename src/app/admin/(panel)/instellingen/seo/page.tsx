import Link from "next/link";
import { saveSeoSettings } from "@/app/admin/actions/manage";
import { SimpleForm } from "@/components/admin/SimpleForm";
import { Field, Panel, input } from "@/components/admin/ui";
import { can, requireUser } from "@/lib/auth";
import { SITE_URL, getSeo } from "@/lib/settings";

export const metadata = { title: "Instellingen: SEO" };

export default async function SeoSettingsPage() {
  const user = await requireUser();
  const seo = await getSeo();
  return (
    <>
      <Panel title="Zoekmachines">
        <SimpleForm action={saveSeoSettings}>
          <Field label="Bing Webmaster-verificatie (msvalidate.01)" hint={can(user, "admin") ? "(Google Search Console staat bij Connecties → Google)" : "(de code of de hele meta-tag)"}>
            <input name="bingVerification" defaultValue={seo.bingVerification} className={`${input} max-w-xl font-mono`} />
          </Field>
        </SimpleForm>
      </Panel>
      <Panel title="Handig">
        <ul className="space-y-2 text-sm">
          <li>
            Sitemap: <code className="rounded bg-cream px-1.5 py-0.5">{SITE_URL}/sitemap_index.xml</code>{" "}
            <a href="/sitemap_index.xml" target="_blank" className="underline">
              openen ↗
            </a>
          </li>
          <li>
            <a href="/robots.txt" target="_blank" className="underline">
              robots.txt ↗
            </a>
          </li>
          <li>
            Meta-titles en -descriptions per pagina, product, categorie en blog pas je aan in het{" "}
            <Link href="/admin/seo/" className="underline">
              SEO-overzicht
            </Link>
            ; doorverwijzingen bij{" "}
            <Link href="/admin/redirects/" className="underline">
              Redirects
            </Link>
            .
          </li>
        </ul>
      </Panel>
    </>
  );
}
