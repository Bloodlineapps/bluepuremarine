"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { setShippingCountry } from "@/app/actions/shop";
import { placeOrder, type CheckoutState } from "@/app/(site)/afrekenen/actions";
import { money } from "@/lib/money";
import { announceCart } from "./CartIndicator";
import { AddressFields, TextField } from "./FormFields";

// Het afrekenformulier: gegevens, bezorgadres, eventueel factuuradres, betaalmethode en akkoord, op één pagina.
// De server controleert alles opnieuw; foutmeldingen komen per veld terug en ingevulde waarden blijven staan.

export type CheckoutFormProps = {
  /** ingelogde klant (e-mailadres ligt dan vast) */
  customer: { email: string; firstName: string } | null;
  /** vooringevulde waarden (account + standaardadres) */
  defaults: Record<string, string>;
  countries: { value: string; label: string }[];
  mode: "mollie" | "simulatie" | "overboeking";
  methods: { id: string; name: string; image: string }[];
  /** totaalbedrag dat de klant nu ziet (wordt op de server vergeleken met de actuele berekening) */
  total: number;
  hasIban: boolean;
};

const Section = ({ step, title, children }: { step: number; title: string; children: React.ReactNode }) => (
  <section className="card p-5 sm:p-6">
    <h2 className="mb-4 flex items-center gap-3 text-xl">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white" aria-hidden="true">
        {step}
      </span>
      {title}
    </h2>
    {children}
  </section>
);

const checkRow = "flex cursor-pointer items-start gap-3 text-sm leading-snug text-ink-2";
const checkBox = "mt-0.5 h-5 w-5 shrink-0 rounded border-rule accent-brand";

export function CheckoutForm({ customer, defaults, countries, mode, methods, total, hasIban }: CheckoutFormProps) {
  const [state, action, pending] = useActionState<CheckoutState, FormData>(placeOrder, { errors: {}, values: {} });
  const router = useRouter();
  const alertRef = useRef<HTMLDivElement>(null);
  const values = { ...defaults, ...state.values };
  const errors = state.errors;
  const on = (k: string) => values[k] === "on";

  useEffect(() => {
    if (state.message) alertRef.current?.focus();
  }, [state]);

  // Ander land = andere verzendkosten: op de server bijwerken en het overzicht verversen
  const changeCountry = (country: string) => {
    setShippingCountry(country)
      .then((res) => {
        announceCart({ count: res.count, total: res.total });
        router.refresh();
      })
      .catch(() => {});
  };

  const errorCount = Object.keys(errors).length;
  const pay = total > 0 ? mode : "gratis";
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="total" value={total} readOnly />

      {state.message && (
        <div ref={alertRef} tabIndex={-1} role="alert" className="rounded-lg border border-coral bg-coral-100 px-4 py-3 text-sm font-medium text-danger outline-none">
          <p>{state.message}</p>
          {errorCount > 0 && (
            <ul className="mt-1.5 list-disc pl-5 font-normal">
              {Object.entries(errors).map(([k, m]) => (
                <li key={k}>
                  <a href={`#f-${k}`} className="underline underline-offset-2">
                    {m}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Section step={1} title="Je gegevens">
        {customer ? (
          <p className="mb-4 rounded-lg bg-brand-50 px-4 py-3 text-sm text-ink">
            Je bent ingelogd als <strong>{customer.email}</strong>. De bevestiging sturen we naar dit adres.
          </p>
        ) : (
          <p className="mb-4 text-sm text-muted">
            Heb je al een account?{" "}
            <Link href="/account/inloggen/?terug=/afrekenen/" className="link font-semibold">
              Inloggen
            </Link>
            . Bestellen kan ook zonder account.
          </p>
        )}
        <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2">
          {!customer && <TextField name="email" label="E-mailadres" type="email" value={values.email} error={errors.email} autoComplete="email" required inputMode="email" maxLength={160} hint="Hier sturen we je bevestiging naartoe" />}
          <TextField name="phone" label="Telefoonnummer" type="tel" optional value={values.phone} error={errors.phone} autoComplete="tel" inputMode="tel" maxLength={30} hint="Voor vragen van de bezorger" />
        </div>
      </Section>

      <Section step={2} title="Bezorgadres">
        <AddressFields values={values} errors={errors} countries={countries} onCountryChange={changeCountry} />

        <div className="mt-5">
          <input id="f-billingDifferent" type="checkbox" name="billingDifferent" defaultChecked={on("billingDifferent")} className={`peer float-left mr-3 ${checkBox}`} />
          <label htmlFor="f-billingDifferent" className="cursor-pointer text-sm leading-snug text-ink-2">
            Factuuradres is anders dan het bezorgadres
          </label>
          <div className="mt-5 hidden clear-both border-t border-rule pt-5 peer-checked:block">
            <h3 className="mb-4 text-lg">Factuuradres</h3>
            <AddressFields prefix="b_" section="billing" values={values} errors={errors} countries={countries} />
          </div>
        </div>
      </Section>

      <Section step={3} title="Betaalmethode">
        {pay === "mollie" && methods.length > 0 && (
          <fieldset>
            <legend className="sr-only">Kies een betaalmethode</legend>
            <div id="f-method" className="grid gap-2 sm:grid-cols-2">
              {methods.map((m, i) => (
                <label key={m.id} className="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border-[1.5px] border-rule bg-white px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-brand has-[:checked]:border-brand has-[:checked]:bg-brand-50">
                  <input type="radio" name="method" value={m.id} defaultChecked={values.method ? values.method === m.id : i === 0} className="h-4 w-4 accent-brand" />
                  {/* eslint-disable-next-line @next/next/no-img-element -- logo komt rechtstreeks van Mollie */}
                  {m.image && <img src={m.image} alt="" width={32} height={24} loading="lazy" className="h-6 w-8 object-contain" />}
                  <span>{m.name}</span>
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">Je betaalt veilig in de beveiligde omgeving van Mollie. Wij slaan geen betaalgegevens op.</p>
          </fieldset>
        )}
        {pay === "mollie" && methods.length === 0 && <p className="text-sm text-ink-2">Je kiest je betaalmethode in de volgende stap, in de beveiligde betaalomgeving van Mollie. Wij slaan geen betaalgegevens op.</p>}
        {pay === "simulatie" && (
          <div className="rounded-lg border-2 border-dashed border-sun bg-sun-100 px-4 py-3 text-sm text-ink">
            <strong>Testomgeving:</strong> betalingen worden gesimuleerd. In de volgende stap kies je zelf of de betaling slaagt, mislukt of wordt geannuleerd. Er wordt niets afgeschreven.
          </div>
        )}
        {pay === "gratis" && <p className="text-sm text-ink-2">Door je korting hoef je niets te betalen.</p>}
        {pay === "overboeking" && (
          <div className="rounded-lg bg-brand-50 px-4 py-3 text-sm text-ink">
            <strong>Betalen per overboeking.</strong> {hasIban ? "Na het plaatsen van je bestelling zie je de betaalgegevens en ontvang je ze ook per e-mail. Zodra je betaling binnen is, versturen we je bestelling." : "Na het plaatsen van je bestelling nemen we contact met je op over de betaling."}
          </div>
        )}
        {errors.method && <p className="mt-2 text-sm font-medium text-danger">{errors.method}</p>}
      </Section>

      <Section step={4} title="Afronden">
        <div>
          <label htmlFor="f-note" className="label">
            Opmerking bij je bestelling <span className="font-normal text-muted">(optioneel)</span>
          </label>
          <textarea id="f-note" name="note" rows={3} maxLength={1000} defaultValue={values.note ?? ""} className="field" aria-invalid={errors.note ? true : undefined} />
          {errors.note && <p className="mt-1 text-sm font-medium text-danger">{errors.note}</p>}
        </div>

        {!customer && (
          <div className="mt-5">
            <input id="f-createAccount" type="checkbox" name="createAccount" defaultChecked={on("createAccount")} className={`peer float-left mr-3 ${checkBox}`} />
            <label htmlFor="f-createAccount" className="cursor-pointer text-sm leading-snug text-ink-2">
              Maak een account aan, zodat je je bestellingen kunt volgen en de volgende keer sneller afrekent
            </label>
            <div className="mt-4 hidden clear-both max-w-sm peer-checked:block">
              <TextField name="password" label="Kies een wachtwoord" type="password" error={errors.password} autoComplete="new-password" minLength={8} maxLength={200} hint="Minimaal 8 tekens" />
            </div>
          </div>
        )}

        <label className={`${checkRow} mt-5`}>
          <input type="checkbox" name="newsletter" defaultChecked={on("newsletter")} className={checkBox} />
          <span>Ja, ik ontvang graag de nieuwsbrief met tips en aanbiedingen</span>
        </label>

        <div className="mt-4">
          <label className={checkRow}>
            <input id="f-terms" type="checkbox" name="terms" defaultChecked={on("terms")} className={checkBox} aria-invalid={errors.terms ? true : undefined} required />
            <span>
              Ik ga akkoord met de{" "}
              <Link href="/algemene-voorwaarden/" target="_blank" className="link">
                algemene voorwaarden
              </Link>
            </span>
          </label>
          {errors.terms && <p className="mt-1 pl-8 text-sm font-medium text-danger">{errors.terms}</p>}
        </div>

        <button type="submit" className="btn-accent btn-lg mt-6 w-full" disabled={pending} aria-busy={pending}>
          {pending ? "Bezig met je bestelling…" : pay === "overboeking" || pay === "gratis" ? `Bestelling plaatsen (${money(total)})` : `Bestellen en betalen (${money(total)})`}
        </button>
        <p className="mt-3 text-center text-xs text-muted">Met het plaatsen van je bestelling ga je een betalingsverplichting aan.</p>
      </Section>
    </form>
  );
}
