import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteCustomer, saveCustomer } from "@/app/admin/actions/shop";
import { SimpleForm } from "@/components/admin/SimpleForm";
import { DeleteButton } from "@/components/admin/fields";
import { addressLines } from "@/components/admin/shop/format";
import { customerStats } from "@/components/admin/shop/queries";
import { Badge, Field, Notice, PageHeader, Panel, Stat, btnSm, fmtDate, fmtDateTime, input } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/money";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/orders";

export const metadata = { title: "Klant" };

// Klantdetail: gegevens (aanpasbaar), adressen en bestellingen. Het wachtwoord is nergens zichtbaar.
export default async function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("user");
  const { id } = await params;
  const c = await db.customer.findUnique({ where: { id }, include: { addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] }, orders: { orderBy: { createdAt: "desc" } } } });
  if (!c) notFound();
  const stats = (await customerStats([c.id])).get(c.id) ?? { count: 0, spent: 0 };
  return (
    <>
      <PageHeader
        title={`${c.firstName} ${c.lastName}`}
        description={`Klant sinds ${fmtDate(c.createdAt)} · laatste login: ${c.lastLoginAt ? fmtDateTime(c.lastLoginAt) : "nooit"}`}
        action={
          <Link href="/admin/klanten/" className={btnSm}>
            Alle klanten
          </Link>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Bestellingen" value={stats.count} />
        <Stat label="Totaal besteed" value={money(stats.spent)} sub="betaald, na terugbetalingen" />
        <Stat label="Nieuwsbrief" value={c.newsletter ? "Ja" : "Nee"} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <Panel title="Bestellingen">
            {c.orders.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line text-xs uppercase tracking-wider text-ink-soft">
                    <tr>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Nummer
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Datum
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Totaal
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Betaling
                      </th>
                      <th scope="col" className="py-2 font-medium">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {c.orders.map((o) => (
                      <tr key={o.id}>
                        <td className="py-2.5 pr-3">
                          <Link href={`/admin/bestellingen/${o.id}/`} className="font-mono font-medium hover:underline">
                            {o.number}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap py-2.5 pr-3">{fmtDateTime(o.createdAt)}</td>
                        <td className="whitespace-nowrap py-2.5 pr-3">{money(o.total)}</td>
                        <td className="py-2.5 pr-3">
                          <Badge tone={PAYMENT_STATUS[o.paymentStatus]?.tone}>{PAYMENT_STATUS[o.paymentStatus]?.label ?? o.paymentStatus}</Badge>
                        </td>
                        <td className="py-2.5">
                          <Badge tone={ORDER_STATUS[o.status]?.tone}>{ORDER_STATUS[o.status]?.label ?? o.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-ink-soft">Deze klant heeft nog niets besteld.</p>
            )}
          </Panel>
          <Panel title="Adressen">
            {c.addresses.length ? (
              <ul className="grid gap-4 sm:grid-cols-2">
                {c.addresses.map((a) => (
                  <li key={a.id} className="rounded-xl border border-line p-4 text-sm">
                    <span className="mb-2 flex flex-wrap gap-1">
                      <Badge>{a.type === "billing" ? "Factuuradres" : "Bezorgadres"}</Badge>
                      {a.isDefault && <Badge tone="brand">Standaard</Badge>}
                    </span>
                    <address className="not-italic">
                      {addressLines(a).map((l, i) => (
                        <span key={i} className="block">
                          {l}
                        </span>
                      ))}
                    </address>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-soft">Deze klant heeft nog geen adressen opgeslagen.</p>
            )}
          </Panel>
        </div>
        <aside className="space-y-6">
          <Panel title="Gegevens">
            <SimpleForm action={saveCustomer.bind(null, c.id)}>
              <Field label="Voornaam">
                <input name="firstName" defaultValue={c.firstName} required className={input} />
              </Field>
              <Field label="Achternaam">
                <input name="lastName" defaultValue={c.lastName} required className={input} />
              </Field>
              <Field label="E-mailadres" hint="(ook de inlognaam van de klant)">
                <input name="email" type="email" defaultValue={c.email} required className={input} />
              </Field>
              <Field label="Telefoon">
                <input name="phone" defaultValue={c.phone} className={input} />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="newsletter" defaultChecked={c.newsletter} /> Aangemeld voor de nieuwsbrief
              </label>
            </SimpleForm>
            <p className="mt-3 text-xs text-ink-soft">Het wachtwoord is versleuteld opgeslagen en niet in te zien. De klant kan het zelf opnieuw instellen via &quot;Wachtwoord vergeten&quot;.</p>
          </Panel>
          <Panel title="Verwijderen">
            <p className="mb-3 text-sm text-ink-soft">Het account en de opgeslagen adressen worden definitief verwijderd. De bestellingen blijven bewaard, zonder koppeling met het account.</p>
            <DeleteButton action={deleteCustomer.bind(null, c.id)} label="Klantaccount verwijderen" confirmText={`Het account van ${c.firstName} ${c.lastName} definitief verwijderen? De bestellingen blijven bewaard. Dit kan niet ongedaan worden gemaakt.`} />
          </Panel>
        </aside>
      </div>
    </>
  );
}
