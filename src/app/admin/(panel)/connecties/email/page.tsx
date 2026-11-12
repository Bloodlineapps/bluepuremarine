import { saveSparkpost, sendTestMail, testSparkpostConnection, toggleConnection } from "@/app/admin/actions/manage";
import { ConnectionCard } from "@/components/admin/ConnectionCard";
import { SimpleForm } from "@/components/admin/SimpleForm";
import { Badge, Field, Panel, fmtDateTime, input } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getConnections } from "@/lib/settings";

export const metadata = { title: "Connecties: E-mail" };

export default async function EmailTab() {
  await requireUser("admin");
  const [s, log] = await Promise.all([getConnections().then((c) => c.sparkpost), db.mailLog.findMany({ orderBy: { createdAt: "desc" }, take: 30 })]);
  return (
    <>
      <ConnectionCard title="SparkPost" description="Alle e-mails van de webshop gaan via deze koppeling: bestelbevestigingen, verzendmeldingen, wachtwoord herstellen, meldingen van formulieren en bevestigingen aan invullers. Zonder koppeling worden bestellingen en inzendingen wel opgeslagen, maar niet gemaild; in het verzendlog staat dan de status “niet ingesteld”." status={{ configured: !!s.keyEnc, enabled: s.enabled, lastTest: s.lastTest }} toggle={toggleConnection.bind(null, "sparkpost")} test={testSparkpostConnection}>
        <SimpleForm action={saveSparkpost}>
          <input type="hidden" name="enabled" value={s.enabled ? "on" : ""} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="API-sleutel" hint={s.keyHint ? `(ingesteld ${s.keyHint}; leeg = behouden)` : ""}>
              <input name="key" type="password" autoComplete="off" className={`${input} font-mono`} placeholder={s.keyHint || ""} />
            </Field>
            <Field label="Regio">
              <select name="region" defaultValue={s.region} className={input}>
                <option value="eu">EU (api.eu.sparkpost.com)</option>
                <option value="us">US (api.sparkpost.com)</option>
              </select>
            </Field>
            <Field label="Afzenderadres">
              <input name="fromEmail" type="email" defaultValue={s.fromEmail} className={input} />
            </Field>
            <Field label="Afzendernaam">
              <input name="fromName" defaultValue={s.fromName} className={input} />
            </Field>
            <Field label="Reply-to-adres">
              <input name="replyTo" type="email" defaultValue={s.replyTo} className={input} />
            </Field>
          </div>
          <p className="text-sm">
            Verzenddomein (SPF/DKIM): <strong>{s.domainStatus ?? "nog niet gecontroleerd — klik op Verbinding testen"}</strong>
          </p>
        </SimpleForm>
      </ConnectionCard>

      <Panel title="Testmail sturen">
        <SimpleForm action={sendTestMail} submitLabel="Testmail versturen">
          <Field label="Naar e-mailadres">
            <input name="to" type="email" required className={`${input} max-w-sm`} />
          </Field>
        </SimpleForm>
      </Panel>

      <Panel title="Verzendlog (laatste 30)">
        {log.length ? (
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-ink-soft">
              <tr>
                <th className="py-2">Tijd</th>
                <th>Aan</th>
                <th>Onderwerp</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {log.map((l) => (
                <tr key={l.id}>
                  <td className="py-2 pr-3 whitespace-nowrap">{fmtDateTime(l.createdAt)}</td>
                  <td className="pr-3">{l.to}</td>
                  <td className="pr-3">{l.subject}</td>
                  <td>
                    <Badge tone={l.status === "verstuurd" ? "success" : l.status === "gebounced" ? "warning" : l.status === "niet ingesteld" ? "neutral" : "danger"}>{l.status}</Badge>
                    {l.error && <span className="block text-xs text-danger">{l.error}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        ) : (
          <p className="text-sm text-ink-soft">Nog geen e-mails verstuurd.</p>
        )}
        {log.some((l) => l.status === "niet ingesteld") && (
          <p className="mt-3 text-xs text-ink-soft">“Niet ingesteld” betekent: de webshop wilde deze e-mail versturen, maar SparkPost staat uit of heeft geen sleutel. De e-mail is niet verstuurd.</p>
        )}
      </Panel>
    </>
  );
}
