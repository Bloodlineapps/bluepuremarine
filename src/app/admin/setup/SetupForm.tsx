"use client";
import { useActionState } from "react";
import { setupSuperadmin } from "../actions/setup";

export function SetupForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(setupSuperadmin, {});
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      <label className="block">
        <span className="label">E-mailadres</span>
        <input name="email" type="email" autoComplete="username" autoCapitalize="none" required className="field" />
      </label>
      <label className="block">
        <span className="label">Naam</span>
        <input name="name" type="text" autoComplete="name" required minLength={2} className="field" />
      </label>
      <label className="block">
        <span className="label">Wachtwoord (minimaal 12 tekens)</span>
        <input name="password" type="password" autoComplete="new-password" required minLength={12} className="field" />
      </label>
      <label className="block">
        <span className="label">Herhaal het wachtwoord</span>
        <input name="again" type="password" autoComplete="new-password" required minLength={12} className="field" />
      </label>
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Bezig…" : "Superadmin aanmaken en inloggen"}
      </button>
    </form>
  );
}
