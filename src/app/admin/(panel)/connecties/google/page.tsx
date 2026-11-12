import Link from "next/link";
import { saveGoogle, saveGoogleReviews, testGoogle, testGoogleReviews, toggleConnection } from "@/app/admin/actions/manage";
import { ConnectionCard } from "@/components/admin/ConnectionCard";
import { SimpleForm } from "@/components/admin/SimpleForm";
import { Field, fmtDateTime, input } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";
import { SITE_URL, getConnections, getReviewSettings } from "@/lib/settings";

export const metadata = { title: "Connecties: Google" };

export default async function GoogleTab() {
  await requireUser("admin");
  const [c, reviews] = await Promise.all([getConnections(), getReviewSettings()]);
  const gr = c.googleReviews;
  return (
    <>
      <ConnectionCard title="Google Tag Manager" description="Laadt de GTM-container in de head van elke publieke pagina (en de noscript-iframe direct na de body). Nooit in het beheer. Consent Mode v2: alles staat standaard op 'denied' tot de bezoeker toestemming geeft." status={{ configured: !!c.gtm.containerId, enabled: c.gtm.enabled, lastTest: c.gtm.lastTest }} toggle={toggleConnection.bind(null, "gtm")} test={testGoogle.bind(null, "gtm")}>
        <SimpleForm action={saveGoogle.bind(null, "gtm")}>
          <input type="hidden" name="enabled" value={c.gtm.enabled ? "on" : ""} />
          <Field label="Container-ID" hint="(GTM-XXXXXXX)">
            <input name="containerId" defaultValue={c.gtm.containerId} pattern="GTM-[A-Za-z0-9]{4,10}" className={`${input} max-w-xs font-mono`} placeholder="GTM-XXXXXXX" />
          </Field>
          <Field label="Extra code in de head" hint="(optioneel, alleen als GTM aan staat)">
            <textarea name="headCode" defaultValue={c.gtm.headCode} rows={3} className={`${input} font-mono text-xs`} />
          </Field>
          <Field label="Extra code na de body-tag" hint="(optioneel)">
            <textarea name="bodyCode" defaultValue={c.gtm.bodyCode} rows={3} className={`${input} font-mono text-xs`} />
          </Field>
        </SimpleForm>
      </ConnectionCard>

      <ConnectionCard
        title="Google Analytics 4"
        description={c.gtm.enabled ? "Tag Manager staat aan: laad GA4 via je GTM-container. Deze directe koppeling wordt dan niet gebruikt." : "Laadt GA4 rechtstreeks (gtag.js), alleen na cookietoestemming via Consent Mode v2. Property-ID en serviceaccount zijn optioneel."}
        status={{ configured: !!c.ga4.measurementId, enabled: c.ga4.enabled, lastTest: c.ga4.lastTest }}
        toggle={toggleConnection.bind(null, "ga4")}
        test={testGoogle.bind(null, "ga4")}
      >
        <SimpleForm action={saveGoogle.bind(null, "ga4")}>
          <input type="hidden" name="enabled" value={c.ga4.enabled ? "on" : ""} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Measurement-ID" hint="(G-XXXXXXXXXX)">
              <input name="measurementId" defaultValue={c.ga4.measurementId} pattern="G-[A-Za-z0-9]{6,12}" className={`${input} font-mono`} placeholder="G-XXXXXXXXXX" />
            </Field>
            <Field label="Property-ID" hint="(optioneel, cijfers)">
              <input name="propertyId" defaultValue={c.ga4.propertyId} inputMode="numeric" className={`${input} font-mono`} />
            </Field>
          </div>
          <Field label="Serviceaccount (JSON-sleutel)" hint={c.ga4.serviceAccountHint ? `(ingesteld: ${c.ga4.serviceAccountHint}; leeg laten = behouden)` : "(optioneel)"}>
            <textarea name="serviceAccount" rows={3} className={`${input} font-mono text-xs`} placeholder='{"type":"service_account", …}' autoComplete="off" />
          </Field>
        </SimpleForm>
      </ConnectionCard>

      <ConnectionCard title="Google Search Console" description="De verificatiecode komt als meta-tag google-site-verification in de head van elke pagina. Dien daarna de sitemap in." status={{ configured: !!c.gsc.verification, enabled: c.gsc.enabled, lastTest: c.gsc.lastTest }} toggle={toggleConnection.bind(null, "gsc")} test={testGoogle.bind(null, "gsc")}>
        <SimpleForm action={saveGoogle.bind(null, "gsc")}>
          <input type="hidden" name="enabled" value={c.gsc.enabled ? "on" : ""} />
          <Field label="Verificatiecode" hint="(de code of de hele meta-tag)">
            <input name="verification" defaultValue={c.gsc.verification} className={`${input} font-mono`} />
          </Field>
          <p className="text-sm">
            Sitemap om in te dienen: <code className="rounded bg-cream px-1.5 py-0.5">{SITE_URL}/sitemap_index.xml</code>
          </p>
        </SimpleForm>
      </ConnectionCard>

      <ConnectionCard
        title="Google Reviews"
        description="Haalt via de Places API (New) de reviewscore en het aantal reviews van het Google-bedrijfsprofiel op, voor de score in de header van de webshop. De knop Verbinding testen haalt de score op en werkt de reviewinstellingen bij."
        status={{ configured: !!(gr.placeId && gr.keyEnc), enabled: gr.enabled, lastTest: gr.lastTest }}
        toggle={toggleConnection.bind(null, "googleReviews")}
        test={testGoogleReviews}
      >
        <SimpleForm action={saveGoogleReviews}>
          <input type="hidden" name="enabled" value={gr.enabled ? "on" : ""} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Place ID" hint="(van het bedrijfsprofiel, begint meestal met ChIJ)">
              <input name="placeId" defaultValue={gr.placeId} className={`${input} font-mono`} placeholder="ChIJ…" autoComplete="off" />
            </Field>
            <Field label="API-sleutel (Places API)" hint={gr.keyHint ? `(ingesteld ${gr.keyHint}; leeg = behouden)` : ""}>
              <input name="key" type="password" autoComplete="off" className={`${input} font-mono`} placeholder={gr.keyHint || ""} />
            </Field>
          </div>
          <p className="text-sm text-ink-soft">
            {reviews.source === "google" && reviews.rating > 0 ? (
              <>
                Huidige score op de site: <strong className="text-ink">{String(reviews.rating).replace(".", ",")}</strong> op basis van <strong className="text-ink">{reviews.count}</strong> Google-reviews
                {reviews.updatedAt ? ` (opgehaald ${fmtDateTime(new Date(reviews.updatedAt))})` : ""}.{" "}
              </>
            ) : (
              "Er is nog geen score van Google opgehaald. "
            )}
            Aan/uit en de link naar de reviews stel je in bij{" "}
            <Link href="/admin/instellingen/reviews/" className="underline">
              Instellingen → Reviews
            </Link>
            . De sleutel maak je aan in Google Cloud (Places API (New) inschakelen); beperk hem tot die API.
          </p>
        </SimpleForm>
      </ConnectionCard>
    </>
  );
}
