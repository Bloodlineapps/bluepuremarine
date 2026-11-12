import Link from "next/link";
import { logout } from "@/app/(site)/account/actions";

// Kader van de accountpagina's: titel, eenvoudig zijmenu (mobiel: horizontaal scrollend) en de inhoud.

const NAV = [
  { key: "overzicht", href: "/account/", label: "Overzicht" },
  { key: "bestellingen", href: "/account/bestellingen/", label: "Bestellingen" },
  { key: "adressen", href: "/account/adressen/", label: "Adressen" },
  { key: "gegevens", href: "/account/gegevens/", label: "Mijn gegevens" },
] as const;

export type AccountSection = (typeof NAV)[number]["key"];

export function AccountShell({ active, title, intro, children }: { active: AccountSection; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <div className="container-x py-8 md:py-12">
      <p className="eyebrow">Mijn account</p>
      <h1 className="mt-1 text-3xl md:text-4xl">{title}</h1>
      {intro && <p className="mt-2 max-w-2xl text-muted">{intro}</p>}
      <div className="mt-6 grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-8">
        <nav aria-label="Account" className="card p-2 lg:sticky lg:top-28">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col">
            {NAV.map((n) => (
              <li key={n.key} className="shrink-0">
                <Link
                  href={n.href}
                  aria-current={n.key === active ? "page" : undefined}
                  className={`flex min-h-11 items-center rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${n.key === active ? "bg-brand text-white" : "text-ink hover:bg-brand-50 hover:text-brand"}`}
                >
                  {n.label}
                </Link>
              </li>
            ))}
            <li className="shrink-0 lg:mt-1 lg:border-t lg:border-rule lg:pt-1">
              <form action={logout}>
                <button type="submit" className="flex min-h-11 w-full items-center rounded-lg px-3.5 py-2 text-left text-sm font-semibold text-muted transition-colors hover:bg-coral-100 hover:text-danger">
                  Uitloggen
                </button>
              </form>
            </li>
          </ul>
        </nav>
        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </div>
  );
}

/** Smal kader voor inloggen, registreren en wachtwoord vergeten. */
export function AuthCard({ title, intro, children, footer }: { title: string; intro?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="container-x py-10 md:py-14">
      <div className="mx-auto max-w-md">
        <div className="card p-6 sm:p-8">
          <h1 className="text-2xl md:text-3xl">{title}</h1>
          {intro && <p className="mt-2 text-sm text-muted">{intro}</p>}
          <div className="mt-5">{children}</div>
        </div>
        {footer && <div className="mt-5 text-center text-sm text-ink-2">{footer}</div>}
      </div>
    </div>
  );
}
