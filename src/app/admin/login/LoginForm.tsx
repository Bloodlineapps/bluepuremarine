"use client";
import { useActionState } from "react";
import { login } from "../actions/auth";

export function LoginForm({ terug }: { terug: string }) {
  const [state, action, pending] = useActionState(login, {});
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="terug" value={terug} />
      {state.error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      <label className="block">
        <span className="label">Gebruikersnaam of e-mailadres</span>
        <input name="email" type="text" autoComplete="username" autoCapitalize="none" required className="field" />
      </label>
      <label className="block">
        <span className="label">Wachtwoord</span>
        <input name="password" type="password" autoComplete="current-password" required className="field" />
      </label>
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Bezig…" : "Inloggen"}
      </button>
    </form>
  );
}
