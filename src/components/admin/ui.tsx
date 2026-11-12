import Link from "next/link";

// Gedeelde presentatiecomponenten voor het beheer.
export function PageHeader({ title, description, action }: { title: string; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-sans text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}

export function Panel({ children, className = "", title, action }: { children: React.ReactNode; className?: string; title?: string; action?: React.ReactNode }) {
  return (
    <section className={`rounded-2xl border border-line bg-white p-5 sm:p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="font-sans text-sm font-semibold uppercase tracking-wider text-ink-soft">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

type Tone = "neutral" | "success" | "warning" | "danger" | "brand";
const TONES: Record<Tone, string> = {
  neutral: "bg-cream-2 text-ink-soft",
  success: "bg-success/12 text-success",
  warning: "bg-sun-100 text-[#7a5a10]",
  danger: "bg-danger/10 text-danger",
  brand: "bg-brand-100 text-brand-700",
};
export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  return status === "published" ? <Badge tone="success">Gepubliceerd</Badge> : <Badge tone="warning">Concept</Badge>;
}

export function Notice({ children, tone = "success" }: { children: React.ReactNode; tone?: "success" | "danger" | "warning" }) {
  return (
    <p className={`mb-5 rounded-xl px-4 py-3 text-sm ${tone === "success" ? "bg-success/10 text-success" : tone === "warning" ? "bg-sun-100 text-[#7a5a10]" : "bg-danger/10 text-danger"}`} role="status">
      {children}
    </p>
  );
}

export const btn = "inline-flex items-center justify-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-navy disabled:opacity-40";
export const btnSm = "inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink transition hover:border-brand hover:text-brand disabled:opacity-40";
export const btnDanger = "inline-flex items-center gap-1.5 rounded-full border border-danger/30 bg-white px-3 py-1.5 text-xs font-medium text-danger transition hover:bg-danger hover:text-white disabled:opacity-40";
export const input = "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none transition focus:border-lilac-700 focus:ring-2 focus:ring-lilac/50 disabled:bg-cream";

export function Field({ label, hint, children, className = "" }: { label: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-medium text-ink-soft">
        {label} {hint && <span className="font-normal text-ink-soft/70">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

const dt = new Intl.DateTimeFormat("nl-NL", { timeZone: "Europe/Amsterdam", dateStyle: "medium", timeStyle: "short" });
const d = new Intl.DateTimeFormat("nl-NL", { timeZone: "Europe/Amsterdam", dateStyle: "medium" });
export const fmtDateTime = (v: Date | null | undefined) => (v ? dt.format(v) : "–");
export const fmtDate = (v: Date | null | undefined) => (v ? d.format(v) : "–");

export function Stat({ label, value, href, sub }: { label: string; value: React.ReactNode; href?: string; sub?: React.ReactNode }) {
  const inner = (
    <>
      <p className="text-xs font-medium uppercase tracking-wider text-ink-soft">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-soft">{sub}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="block rounded-2xl border border-line bg-white p-5 transition hover:border-brand">
      {inner}
    </Link>
  ) : (
    <div className="rounded-2xl border border-line bg-white p-5">{inner}</div>
  );
}
