import { saveMollie, testMollie, toggleConnection } from "@/app/admin/actions/manage";
import { ConnectionCard } from "@/components/admin/ConnectionCard";
import { CopyField } from "@/components/admin/CopyField";
import { SimpleForm } from "@/components/admin/SimpleForm";
import { Badge, Field, Notice, input } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";
import { SITE_URL, getConnections } from "@/lib/settings";

export const metadata = { title: "Connecties: Betalingen" };

export default async function PaymentsTab() {
  await requireUser("admin");
  const m = (await getConnections()).mollie;
  return (
    <>
      {m.simulate && (
        <Notice tone="warning">
          <strong>Testbetalingen simuleren staat aan.</strong> Klanten komen bij het afrekenen op een testpagina en kiezen zelf of de betaling geslaagd, mislukt of geannuleerd is: er wordt geen geld afgeschreven. Alleen voor testen; zet dit uit op de live site.
        </Notice>
      )}
      <ConnectionCard
        title="Mollie"
        description="Betalingen in de webshop lopen via Mollie (iDEAL, Bancontact, creditcard en de andere methodes die in je Mollie-account aan staan). Gebruik de testsleutel om te testen en zet de modus op Live zodra de winkel open gaat."
        status={{ configured: !!(m.testKeyEnc || m.liveKeyEnc), enabled: m.enabled, lastTest: m.lastTest }}
        toggle={toggleConnection.bind(null, "mollie")}
        test={testMollie}
      >
        <SimpleForm action={saveMollie}>
          <input type="hidden" name="enabled" value={m.enabled ? "on" : ""} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Test-API-sleutel" hint={m.testKeyHint ? `(ingesteld ${m.testKeyHint}; leeg = behouden)` : "(test_…)"}>
              <input name="testKey" type="password" autoComplete="off" className={`${input} font-mono`} placeholder={m.testKeyHint || "test_…"} />
            </Field>
            <Field label="Live-API-sleutel" hint={m.liveKeyHint ? `(ingesteld ${m.liveKeyHint}; leeg = behouden)` : "(live_…)"}>
              <input name="liveKey" type="password" autoComplete="off" className={`${input} font-mono`} placeholder={m.liveKeyHint || "live_…"} />
            </Field>
            <Field label="Modus">
              <select name="mode" defaultValue={m.mode} className={input}>
                <option value="test">Testmodus</option>
                <option value="live">Live</option>
              </select>
            </Field>
          </div>

          <label className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${m.simulate ? "border-sun bg-sun-100" : "border-line bg-cream"}`}>
            <input type="checkbox" name="simulate" defaultChecked={m.simulate} className="mt-0.5 h-4 w-4" />
            <span>
              <strong>Testbetalingen simuleren zonder Mollie-sleutel</strong>
              <span className="block text-ink-soft">Alleen voor testen, zet uit op de live site. De klant komt na het afrekenen op een testpagina en kiest zelf betaald, mislukt of geannuleerd; er gaat geen verzoek naar Mollie.</span>
            </span>
          </label>

          <div>
            <p className="mb-1.5 text-xs font-medium text-ink-soft">Actieve betaalmethodes in het Mollie-account ({m.mode === "live" ? "live" : "test"})</p>
            {m.methods.length > 0 ? (
              <p className="flex flex-wrap gap-1.5">
                {m.methods.map((x) => (
                  <Badge key={x} tone="brand">
                    {x}
                  </Badge>
                ))}
              </p>
            ) : (
              <p className="text-sm text-ink-soft">Nog niet opgehaald: klik op Verbinding testen nadat je een sleutel hebt opgeslagen.</p>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-ink-soft">Webhook-URL</p>
            <CopyField value={`${SITE_URL}/api/public/mollie/webhook`} />
            <p className="mt-1.5 text-xs text-ink-soft">
              Betalingen worden altijd aan de serverkant aangemaakt: de sleutel komt nooit in de browser en het bedrag wordt op de server berekend. Mollie meldt elke statuswijziging via de webhook; de webhook vertrouwt die melding niet blind maar haalt de betaling opnieuw op bij Mollie en werkt daarna pas de bestelling bij. De webhook moet vanaf internet bereikbaar zijn (dus niet op localhost).
            </p>
          </div>
        </SimpleForm>
      </ConnectionCard>
    </>
  );
}
