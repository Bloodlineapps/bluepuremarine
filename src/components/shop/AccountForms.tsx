"use client";
import Link from "next/link";
import { useActionState, useEffect } from "react";
import { changeEmail, changePassword, login, register, requestReset, resetPassword, saveAddress, updateDetails, type AccountState } from "@/app/(site)/account/actions";
import { AddressFields, TextField } from "./FormFields";

// Formulieren van het klantaccount. Elk formulier praat met een server action via useActionState: foutmeldingen
// komen per veld terug, ingevulde waarden blijven staan en het werkt ook zonder JavaScript.

function Notice({ state }: { state: AccountState }) {
  if (!state.message) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={`rounded-lg px-4 py-3 text-sm font-medium ${state.ok ? "bg-success-100 text-success" : "border border-coral bg-coral-100 text-danger"}`}>
      {state.message}
    </p>
  );
}

const Submit = ({ pending, children }: { pending: boolean; children: React.ReactNode }) => (
  <button type="submit" className="btn-primary" disabled={pending} aria-busy={pending}>
    {pending ? "Bezig…" : children}
  </button>
);

const checkRow = "flex cursor-pointer items-start gap-3 text-sm leading-snug text-ink-2";
const checkBox = "mt-0.5 h-5 w-5 shrink-0 rounded border-rule accent-brand";

export function LoginForm({ terug }: { terug: string }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(login, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="terug" value={terug} />
      <Notice state={state} />
      <TextField name="email" label="E-mailadres" type="email" value={state.values?.email} autoComplete="email" inputMode="email" required maxLength={160} />
      <TextField name="password" label="Wachtwoord" type="password" autoComplete="current-password" required maxLength={200} />
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <Submit pending={pending}>Inloggen</Submit>
        <Link href="/account/wachtwoord-vergeten/" className="link text-sm">
          Wachtwoord vergeten?
        </Link>
      </div>
    </form>
  );
}

export function RegisterForm({ terug }: { terug: string }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(register, {});
  const v = state.values ?? {};
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="terug" value={terug} />
      <Notice state={state} />
      <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2">
        <TextField name="firstName" label="Voornaam" value={v.firstName} error={e.firstName} autoComplete="given-name" required maxLength={60} />
        <TextField name="lastName" label="Achternaam" value={v.lastName} error={e.lastName} autoComplete="family-name" required maxLength={80} />
      </div>
      <TextField name="email" label="E-mailadres" type="email" value={v.email} error={e.email} autoComplete="email" inputMode="email" required maxLength={160} />
      <TextField name="password" label="Wachtwoord" type="password" error={e.password} autoComplete="new-password" required minLength={8} maxLength={200} hint="Minimaal 8 tekens" />
      <label className={checkRow}>
        <input type="checkbox" name="newsletter" defaultChecked={v.newsletter === "on"} className={checkBox} />
        <span>Ja, ik ontvang graag de nieuwsbrief met tips en aanbiedingen</span>
      </label>
      <Submit pending={pending}>Account aanmaken</Submit>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState<AccountState, FormData>(requestReset, {});
  if (state.ok) return <Notice state={state} />;
  return (
    <form action={action} className="space-y-4">
      <Notice state={state} />
      <TextField name="email" label="E-mailadres" type="email" value={state.values?.email} error={state.errors?.email} autoComplete="email" inputMode="email" required maxLength={160} />
      <Submit pending={pending}>Stuur mij een link</Submit>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(resetPassword, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Notice state={state} />
      <TextField name="password" label="Nieuw wachtwoord" type="password" error={state.errors?.password} autoComplete="new-password" required minLength={8} maxLength={200} hint="Minimaal 8 tekens" />
      <TextField name="password2" label="Herhaal je nieuwe wachtwoord" type="password" error={state.errors?.password2} autoComplete="new-password" required minLength={8} maxLength={200} />
      <Submit pending={pending}>Wachtwoord opslaan</Submit>
    </form>
  );
}

export function AddressForm({ address, countries }: { address: (Record<string, string> & { id?: string; type?: string; isDefault?: string }) | null; countries: { value: string; label: string }[] }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(saveAddress, {});
  const values: Record<string, string> = { ...(address ?? {}), ...(state.values ?? {}) };
  return (
    <form action={action} className="space-y-4">
      {address?.id && <input type="hidden" name="id" value={address.id} />}
      <Notice state={state} />
      <div>
        <label htmlFor="f-type" className="label">
          Soort adres
        </label>
        <select key={values.type || "shipping"} id="f-type" name="type" defaultValue={values.type || "shipping"} className="field sm:max-w-xs">
          <option value="shipping">Bezorgadres</option>
          <option value="billing">Factuuradres</option>
        </select>
      </div>
      <AddressFields values={values} errors={state.errors ?? {}} countries={countries} />
      <label className={checkRow}>
        <input type="checkbox" name="isDefault" defaultChecked={values.isDefault === "on"} className={checkBox} />
        <span>Gebruik dit als standaardadres</span>
      </label>
      <div className="flex flex-wrap gap-3">
        <Submit pending={pending}>Adres opslaan</Submit>
        <Link href="/account/adressen/" className="btn-ghost">
          Annuleren
        </Link>
      </div>
    </form>
  );
}

export function DetailsForm({ customer }: { customer: { firstName: string; lastName: string; phone: string; newsletter: boolean } }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(updateDetails, {});
  const v = state.values;
  const e = state.errors ?? {};
  useEffect(() => {
    if (state.ok) window.dispatchEvent(new Event("customer:changed"));
  }, [state]);
  return (
    <form action={action} className="space-y-4">
      <Notice state={state} />
      <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2">
        <TextField name="firstName" label="Voornaam" value={v?.firstName ?? customer.firstName} error={e.firstName} autoComplete="given-name" required maxLength={60} />
        <TextField name="lastName" label="Achternaam" value={v?.lastName ?? customer.lastName} error={e.lastName} autoComplete="family-name" required maxLength={80} />
      </div>
      <TextField name="phone" label="Telefoonnummer" type="tel" optional value={v?.phone ?? customer.phone} error={e.phone} autoComplete="tel" inputMode="tel" maxLength={30} className="sm:max-w-xs" />
      <label className={checkRow}>
        <input type="checkbox" name="newsletter" defaultChecked={v ? v.newsletter === "on" : customer.newsletter} className={checkBox} />
        <span>Ik ontvang graag de nieuwsbrief met tips en aanbiedingen</span>
      </label>
      <Submit pending={pending}>Gegevens opslaan</Submit>
    </form>
  );
}

export function EmailForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(changeEmail, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-4">
      <Notice state={state} />
      <TextField name="email" label="Nieuw e-mailadres" type="email" value={state.values?.email ?? email} error={e.email} autoComplete="email" inputMode="email" required maxLength={160} />
      <TextField id="f-email-currentPassword" name="currentPassword" label="Je huidige wachtwoord" type="password" error={e.currentPassword} autoComplete="current-password" required maxLength={200} hint="Ter controle dat jij het bent" />
      <Submit pending={pending}>E-mailadres wijzigen</Submit>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<AccountState, FormData>(changePassword, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-4">
      <Notice state={state} />
      <TextField name="currentPassword" label="Huidig wachtwoord" type="password" error={e.currentPassword} autoComplete="current-password" required maxLength={200} />
      <TextField name="newPassword" label="Nieuw wachtwoord" type="password" error={e.newPassword} autoComplete="new-password" required minLength={8} maxLength={200} hint="Minimaal 8 tekens" />
      <TextField name="newPassword2" label="Herhaal je nieuwe wachtwoord" type="password" error={e.newPassword2} autoComplete="new-password" required minLength={8} maxLength={200} />
      <Submit pending={pending}>Wachtwoord wijzigen</Submit>
    </form>
  );
}
