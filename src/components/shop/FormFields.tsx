import type { HTMLInputAutoCompleteAttribute, HTMLInputTypeAttribute } from "react";

// Formuliervelden voor afrekenen en account: label, veld, foutmelding per veld. Ongecontroleerde velden met
// defaultValue, zodat ingevulde waarden na een serverfout blijven staan en het ook zonder JavaScript werkt.

export type FieldValues = Record<string, string>;
export type FieldErrors = Record<string, string>;

export function TextField({
  name,
  label,
  value = "",
  error,
  type = "text",
  autoComplete,
  required = false,
  optional = false,
  hint,
  className = "",
  inputMode,
  maxLength,
  readOnly = false,
  placeholder,
  minLength,
  id: idProp,
}: {
  name: string;
  label: string;
  value?: string;
  error?: string;
  type?: HTMLInputTypeAttribute;
  autoComplete?: HTMLInputAutoCompleteAttribute;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  className?: string;
  inputMode?: "text" | "numeric" | "tel" | "email";
  maxLength?: number;
  readOnly?: boolean;
  placeholder?: string;
  minLength?: number;
  /** eigen id als dezelfde veldnaam twee keer op een pagina staat (standaard "f-<naam>") */
  id?: string;
}) {
  const id = idProp ?? `f-${name}`;
  const describedBy = [error ? `${id}-fout` : "", hint ? `${id}-hint` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
        {optional && <span className="font-normal text-muted"> (optioneel)</span>}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={type === "password" ? undefined : value}
        autoComplete={autoComplete}
        required={required}
        inputMode={inputMode}
        maxLength={maxLength}
        minLength={minLength}
        readOnly={readOnly}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`field ${readOnly ? "bg-paper text-muted" : ""}`}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-fout`} className="mt-1 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Adresvelden. `prefix` komt voor elke veldnaam (bv. "b_" voor het factuuradres). */
export function AddressFields({
  prefix = "",
  values,
  errors,
  countries,
  onCountryChange,
  section = "shipping",
}: {
  prefix?: string;
  values: FieldValues;
  errors: FieldErrors;
  countries: { value: string; label: string }[];
  onCountryChange?: (country: string) => void;
  section?: "shipping" | "billing";
}) {
  const n = (k: string) => prefix + k;
  const v = (k: string) => values[n(k)] ?? "";
  const e = (k: string) => errors[n(k)];
  const ac = (token: string) => `${section} ${token}` as HTMLInputAutoCompleteAttribute;
  return (
    <div className="grid grid-cols-6 gap-x-3 gap-y-4">
      <TextField className="col-span-6 sm:col-span-3" name={n("firstName")} label="Voornaam" value={v("firstName")} error={e("firstName")} autoComplete={ac("given-name")} required maxLength={60} />
      <TextField className="col-span-6 sm:col-span-3" name={n("lastName")} label="Achternaam" value={v("lastName")} error={e("lastName")} autoComplete={ac("family-name")} required maxLength={80} />
      <TextField className="col-span-6" name={n("company")} label="Bedrijfsnaam" optional value={v("company")} error={e("company")} autoComplete={ac("organization")} maxLength={100} />
      <div className="col-span-6">
        <label htmlFor={`f-${n("country")}`} className="label">
          Land
        </label>
        {/* key: na een serverfout zet React het formulier terug; zonder key springt de keuzelijst naar het eerste land */}
        <select
          key={v("country") || countries[0]?.value}
          id={`f-${n("country")}`}
          name={n("country")}
          defaultValue={v("country") || countries[0]?.value}
          autoComplete={ac("country")}
          className="field"
          aria-invalid={e("country") ? true : undefined}
          onChange={onCountryChange ? (ev) => onCountryChange(ev.target.value) : undefined}
        >
          {countries.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        {e("country") && <p className="mt-1 text-sm font-medium text-danger">{e("country")}</p>}
      </div>
      <TextField className="col-span-6 sm:col-span-2" name={n("postalCode")} label="Postcode" value={v("postalCode")} error={e("postalCode")} autoComplete={ac("postal-code")} required maxLength={12} />
      <TextField className="col-span-3 sm:col-span-2" name={n("houseNumber")} label="Huisnummer" value={v("houseNumber")} error={e("houseNumber")} required maxLength={10} inputMode="numeric" />
      <TextField className="col-span-3 sm:col-span-2" name={n("addition")} label="Toevoeging" value={v("addition")} error={e("addition")} maxLength={12} />
      <TextField className="col-span-6 sm:col-span-3" name={n("street")} label="Straat" value={v("street")} error={e("street")} autoComplete={ac("address-line1")} required maxLength={100} />
      <TextField className="col-span-6 sm:col-span-3" name={n("city")} label="Plaats" value={v("city")} error={e("city")} autoComplete={ac("address-level2")} required maxLength={80} />
    </div>
  );
}
