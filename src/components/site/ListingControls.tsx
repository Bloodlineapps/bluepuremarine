"use client";

// Kleine verbeteringen voor de productlijst mét JavaScript: het filterformulier verstuurt zichzelf zodra je een vakje
// aan- of uitzet, en de sortering zodra je een andere keuze maakt. Zonder JavaScript werkt alles via de knoppen.

export function FilterForm({ id, action, className, children }: { id: string; action: string; className?: string; children: React.ReactNode }) {
  return (
    <form
      id={id}
      action={action}
      method="get"
      className={className}
      onChange={(e) => {
        const el = e.target as unknown as HTMLInputElement;
        if (el.type === "checkbox") e.currentTarget.requestSubmit();
      }}
    >
      {children}
    </form>
  );
}

export function SortSelect({ form, value, options }: { form: string; value: string; options: [string, string][] }) {
  return (
    <select id="sorteer" name="sorteer" form={form} defaultValue={value} onChange={(e) => e.currentTarget.form?.requestSubmit()} className="field h-11 min-h-0 w-auto py-1 pr-8 text-[0.95rem]">
      {options.map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </select>
  );
}
