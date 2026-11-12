import Link from "next/link";
import { notFound } from "next/navigation";
import { orderAction, saveOrderNote } from "@/app/admin/actions/shop";
import { SimpleForm } from "@/components/admin/SimpleForm";
import { OrderActionForm } from "@/components/admin/shop/OrderActionForm";
import { MAIL_LABELS, PAYMENT_PROVIDERS, addressLines, addressOf, euros } from "@/components/admin/shop/format";
import { Badge, Field, PageHeader, Panel, btnSm, fmtDateTime, input } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parse } from "@/lib/json";
import { money } from "@/lib/money";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/orders";
import { like } from "@/lib/search";

export const metadata = { title: "Bestelling" };

// Detail van één bestelling: regels, adressen, betaling, tijdlijn, interne notitie en de afhandelacties.
export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("user");
  const { id } = await params;
  const o = await db.order.findUnique({ where: { id }, include: { items: true, customer: { select: { id: true, firstName: true, lastName: true } } } });
  if (!o) notFound();
  const mails = await db.mailLog.findMany({ where: { to: o.email, subject: like(o.number) }, orderBy: { createdAt: "asc" } });
  const sent = parse<string[]>(o.mailsSent, []);
  const shipping = addressOf(o.shippingAddress);
  const billing = addressOf(o.billingAddress);
  const sameAddress = addressLines(shipping).join("|") === addressLines(billing).join("|");
  const open = o.total - o.refundedAmount;

  const canPay = o.status === "pending" && !["paid", "refunded", "partially_refunded"].includes(o.paymentStatus);
  const canShip = o.status === "paid";
  const wasShipped = ["shipped", "completed"].includes(o.status);
  const canComplete = ["paid", "shipped"].includes(o.status);
  const canCancel = ["pending", "paid"].includes(o.status);
  const canRefund = ["paid", "partially_refunded"].includes(o.paymentStatus) && open > 0;
  const viaMollie = o.paymentProvider === "mollie" && !!o.paymentId;

  const timeline = [
    { at: o.createdAt, label: "Bestelling geplaatst", detail: `${o.items.reduce((n, i) => n + i.quantity, 0)} artikelen, ${money(o.total)}` },
    ...(o.paidAt ? [{ at: o.paidAt, label: "Betaald", detail: [PAYMENT_PROVIDERS[o.paymentProvider] ?? o.paymentProvider, o.paymentMethod].filter(Boolean).join(" · ") }] : []),
    ...(o.shippedAt ? [{ at: o.shippedAt, label: "Verzonden", detail: o.trackingCode ? `Track & trace ${o.trackingCode}` : "Zonder track & trace-code" }] : []),
    ...(o.cancelledAt ? [{ at: o.cancelledAt, label: "Geannuleerd", detail: "" }] : []),
    ...mails.map((m) => ({ at: m.createdAt, label: `E-mail ${m.status}`, detail: `${m.subject}${m.error ? ` (${m.error})` : ""}` })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  return (
    <>
      <PageHeader
        title={`Bestelling ${o.number}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {fmtDateTime(o.createdAt)}
            <Badge tone={ORDER_STATUS[o.status]?.tone}>{ORDER_STATUS[o.status]?.label ?? o.status}</Badge>
            <Badge tone={PAYMENT_STATUS[o.paymentStatus]?.tone}>{PAYMENT_STATUS[o.paymentStatus]?.label ?? o.paymentStatus}</Badge>
          </span>
        }
        action={
          <Link href="/admin/bestellingen/" className={btnSm}>
            Alle bestellingen
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <Panel title="Artikelen">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line text-xs uppercase tracking-wider text-ink-soft">
                  <tr>
                    <th scope="col" className="py-2 pr-3 font-medium" colSpan={2}>
                      Product
                    </th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">
                      Prijs
                    </th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">
                      Aantal
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      Totaal
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {o.items.map((i) => (
                    <tr key={i.id}>
                      <td className="w-14 py-2.5 pr-3">
                        {i.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={i.image} alt="" className="h-12 w-12 rounded-lg border border-line bg-white object-contain" />
                        ) : (
                          <span className="block h-12 w-12 rounded-lg border border-dashed border-line" />
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        {i.productId ? (
                          <Link href={`/admin/producten/${i.productId}/bewerken/`} className="font-medium hover:underline">
                            {i.name}
                          </Link>
                        ) : (
                          <span className="font-medium">{i.name}</span>
                        )}
                        <span className="block text-xs text-ink-soft">{[i.variantName, i.sku && `SKU ${i.sku}`, `${i.vatRate}% btw`].filter(Boolean).join(" · ")}</span>
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-3 text-right">{money(i.unitPrice)}</td>
                      <td className="py-2.5 pr-3 text-right">{i.quantity}</td>
                      <td className="whitespace-nowrap py-2.5 text-right">{money(i.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="ml-auto mt-4 grid max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1 border-t border-line pt-4 text-sm">
              <dt className="text-ink-soft">Subtotaal</dt>
              <dd className="text-right">{money(o.subtotal)}</dd>
              <dt className="text-ink-soft">Verzendkosten</dt>
              <dd className="text-right">{o.shippingCost ? money(o.shippingCost) : "Gratis"}</dd>
              {o.discountAmount > 0 && (
                <>
                  <dt className="text-ink-soft">Korting{o.discountCode ? ` (${o.discountCode})` : ""}</dt>
                  <dd className="text-right">− {money(o.discountAmount)}</dd>
                </>
              )}
              <dt className="font-semibold">Totaal</dt>
              <dd className="text-right font-semibold">{money(o.total)}</dd>
              <dt className="text-xs text-ink-soft">Waarvan btw</dt>
              <dd className="text-right text-xs text-ink-soft">{money(o.vatAmount)}</dd>
              {o.refundedAmount > 0 && (
                <>
                  <dt className="text-danger">Terugbetaald</dt>
                  <dd className="text-right text-danger">− {money(o.refundedAmount)}</dd>
                </>
              )}
            </dl>
            {o.note && (
              <p className="mt-4 rounded-xl bg-cream px-4 py-3 text-sm">
                <strong>Opmerking van de klant:</strong> {o.note}
              </p>
            )}
          </Panel>

          <Panel title="Tijdlijn">
            <ol className="space-y-3 border-l border-line pl-4 text-sm">
              {timeline.map((t, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-ink" aria-hidden="true" />
                  <strong>{t.label}</strong> <span className="text-ink-soft">· {fmtDateTime(t.at)}</span>
                  {t.detail && <span className="block text-xs text-ink-soft">{t.detail}</span>}
                </li>
              ))}
            </ol>
            <p className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-line pt-4 text-sm">
              <span className="text-ink-soft">Verstuurde e-mails:</span>
              {sent.length ? sent.map((m) => <Badge key={m}>{MAIL_LABELS[m] ?? m}</Badge>) : <span className="text-ink-soft">nog geen</span>}
            </p>
          </Panel>

          <Panel title="Interne notitie">
            <SimpleForm action={saveOrderNote.bind(null, o.id)} submitLabel="Notitie opslaan">
              <Field label="Alleen zichtbaar in het beheer" hint="(de klant ziet dit niet)">
                <textarea name="adminNote" defaultValue={o.adminNote} rows={4} className={input} />
              </Field>
            </SimpleForm>
          </Panel>
        </div>

        <aside className="space-y-6">
          <Panel title="Afhandelen">
            <div className="space-y-5 divide-y divide-line [&>*:not(:first-child)]:pt-5">
              {canPay && (
                <OrderActionForm action={orderAction.bind(null, o.id, "paid")} label="Markeer als betaald" confirm={`Bestelling ${o.number} handmatig markeren als betaald? De voorraad wordt afgeboekt en de klant krijgt de orderbevestiging.`}>
                  <p className="text-sm text-ink-soft">Gebruik dit als het geld op een andere manier is binnengekomen, bijvoorbeeld per overboeking.</p>
                </OrderActionForm>
              )}
              {(canShip || wasShipped) && (
                <OrderActionForm action={orderAction.bind(null, o.id, "ship")} label={canShip ? "Verzenden en klant mailen" : "Track & trace bijwerken"}>
                  <Field label="Track & trace-code" hint="(optioneel)">
                    <input name="trackingCode" defaultValue={o.trackingCode ?? ""} className={input} />
                  </Field>
                  <Field label="Track & trace-link" hint="(optioneel, begint met https://)">
                    <input name="trackingUrl" type="url" defaultValue={o.trackingUrl ?? ""} placeholder="https://" className={input} />
                  </Field>
                  <p className="text-xs text-ink-soft">{canShip ? "De klant krijgt direct de verzendbevestiging met deze gegevens." : "De bestelling is al verzonden: de gegevens worden bijgewerkt, er gaat geen tweede e-mail naar de klant."}</p>
                </OrderActionForm>
              )}
              {canComplete && (
                <OrderActionForm action={orderAction.bind(null, o.id, "complete")} label="Afronden">
                  <p className="text-sm text-ink-soft">{o.status === "shipped" ? "De bestelling is verzonden. Rond haar af als alles is afgehandeld." : "Afronden zonder verzendmail, bijvoorbeeld als de klant de bestelling heeft afgehaald."}</p>
                </OrderActionForm>
              )}
              {canRefund && (
                <OrderActionForm action={orderAction.bind(null, o.id, "refund")} label="Terugbetalen" danger confirm={viaMollie ? "Dit bedrag via Mollie terugbetalen aan de klant? Dit kan niet ongedaan worden gemaakt." : "Deze terugbetaling registreren? Maak het bedrag zelf over aan de klant: deze betaling liep niet via Mollie."}>
                  <Field label="Bedrag in euro's" hint={`(maximaal ${money(open)})`}>
                    <input name="amount" defaultValue={euros(open)} inputMode="decimal" className={input} />
                  </Field>
                  <p className="text-xs text-ink-soft">{viaMollie ? "De terugbetaling wordt via Mollie uitgevoerd." : "Deze betaling liep niet via Mollie: de terugbetaling wordt alleen geregistreerd. Maak het bedrag zelf over."}</p>
                </OrderActionForm>
              )}
              {canCancel && (
                <OrderActionForm action={orderAction.bind(null, o.id, "cancel")} label="Bestelling annuleren" danger confirm={`Bestelling ${o.number} annuleren? De klant krijgt een annuleringsmail en de voorraad wordt teruggeboekt.`}>
                  <Field label="Reden" hint="(optioneel; komt in de annuleringsmail)">
                    <textarea name="reason" rows={2} className={input} />
                  </Field>
                </OrderActionForm>
              )}
              {!canPay && !canShip && !wasShipped && !canComplete && !canRefund && !canCancel && <p className="text-sm text-ink-soft">Deze bestelling is afgehandeld; er zijn geen acties meer mogelijk.</p>}
            </div>
          </Panel>

          <Panel title="Klant">
            <p className="text-sm">
              {o.customer ? (
                <Link href={`/admin/klanten/${o.customer.id}/`} className="font-medium underline">
                  {o.customer.firstName} {o.customer.lastName}
                </Link>
              ) : (
                <span className="font-medium">Besteld zonder account</span>
              )}
              <a href={`mailto:${o.email}`} className="block underline">
                {o.email}
              </a>
              {o.phone && (
                <a href={`tel:${o.phone.replace(/\s/g, "")}`} className="block">
                  {o.phone}
                </a>
              )}
            </p>
          </Panel>

          <Panel title={sameAddress ? "Bezorg- en factuuradres" : "Bezorgadres"}>
            <address className="text-sm not-italic">
              {addressLines(shipping).map((l, i) => (
                <span key={i} className="block">
                  {l}
                </span>
              ))}
            </address>
            <p className="mt-2 text-xs text-ink-soft">Verzendwijze: {o.shippingMethod}</p>
            {o.trackingCode && (
              <p className="mt-1 text-xs text-ink-soft">
                Track & trace:{" "}
                {o.trackingUrl ? (
                  <a href={o.trackingUrl} target="_blank" rel="noreferrer" className="underline">
                    {o.trackingCode}
                  </a>
                ) : (
                  o.trackingCode
                )}
              </p>
            )}
          </Panel>
          {!sameAddress && (
            <Panel title="Factuuradres">
              <address className="text-sm not-italic">
                {addressLines(billing).map((l, i) => (
                  <span key={i} className="block">
                    {l}
                  </span>
                ))}
              </address>
            </Panel>
          )}

          <Panel title="Betaling">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-ink-soft">Status</dt>
              <dd>{PAYMENT_STATUS[o.paymentStatus]?.label ?? o.paymentStatus}</dd>
              <dt className="text-ink-soft">Via</dt>
              <dd>{PAYMENT_PROVIDERS[o.paymentProvider] ?? o.paymentProvider}</dd>
              <dt className="text-ink-soft">Methode</dt>
              <dd>{o.paymentMethod || "–"}</dd>
              <dt className="text-ink-soft">Mollie-id</dt>
              <dd className="break-all font-mono text-xs">{o.paymentId ?? "–"}</dd>
              <dt className="text-ink-soft">Betaald op</dt>
              <dd>{fmtDateTime(o.paidAt)}</dd>
              {o.refundedAmount > 0 && (
                <>
                  <dt className="text-ink-soft">Terugbetaald</dt>
                  <dd>{money(o.refundedAmount)}</dd>
                </>
              )}
            </dl>
          </Panel>
        </aside>
      </div>
    </>
  );
}
