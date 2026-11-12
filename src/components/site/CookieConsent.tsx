"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { dict } from "@/lib/i18n";

// Cookiemelding volgens de AVG: bij het eerste bezoek de keuzes "Alles accepteren", "Alleen noodzakelijk" en
// "Instellingen" (noodzakelijk, analytisch, marketing). Google Tag Manager en GA4 starten met Consent Mode v2 op
// "denied" (zie Gtm.tsx en Ga4.tsx); pas na een keuze sturen we een consent-update. De keuze staat 12 maanden in de
// cookie bpm_consent en is altijd te wijzigen via "Cookie-instellingen" in de footer.
type Choice = { analytics: boolean; marketing: boolean; at?: string };
const COOKIE = "bpm_consent";
const OPEN_EVENT = "bpm:cookie-settings";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function readChoice(): Choice | null {
  const m = document.cookie.match(new RegExp(`${COOKIE}=([^;]+)`));
  if (!m) return null;
  try {
    return JSON.parse(decodeURIComponent(m[1])) as Choice;
  } catch {
    return null;
  }
}

function apply(choice: Choice) {
  const value = { analytics: choice.analytics, marketing: choice.marketing, at: new Date().toISOString() };
  document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(value))}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  window.gtag?.("consent", "update", {
    analytics_storage: choice.analytics ? "granted" : "denied",
    ad_storage: choice.marketing ? "granted" : "denied",
    ad_user_data: choice.marketing ? "granted" : "denied",
    ad_personalization: choice.marketing ? "granted" : "denied",
  });
  window.dataLayer?.push({ event: "consent_update" });
}

export function CookieConsent({ cookiesHref }: { cookiesHref: string | null }) {
  const t = dict("nl").cookies;
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  const [choice, setChoice] = useState<Choice>({ analytics: false, marketing: false });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const existing = readChoice();
    if (existing) setChoice(existing);
    else setOpen(true);
    const onOpen = () => {
      setDetails(true);
      setOpen(true);
      requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>("input:not([disabled]),button")?.focus());
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  if (!open) return null;
  const save = (c: Choice) => {
    apply(c);
    setChoice(c);
    setOpen(false);
  };

  return (
    <div ref={ref} role="dialog" aria-modal="false" aria-labelledby="cookie-title" className={`fixed inset-x-3 bottom-3 z-[70] max-h-[calc(100dvh-1.5rem)] animate-fade-up overflow-y-auto rounded-card border border-rule bg-sheet p-4 text-ink-2 shadow-lift sm:right-auto sm:bottom-5 sm:left-5 sm:p-5 sm:w-[30rem]`}>
      <h2 id="cookie-title" className="text-[1.02rem] font-bold text-ink">
        {details ? t.dialog : t.title}
      </h2>
      <p className="mt-1.5 text-[0.86rem] leading-snug">
        {t.text}
        {cookiesHref && (
          <>
            {" "}
            <Link href={cookiesHref} className="link">
              {t.readMore}
            </Link>
            .
          </>
        )}
      </p>
      {details && (
        <fieldset className="mt-3 border-t border-rule">
          <legend className="sr-only">{t.dialog}</legend>
          {[
            { key: "necessary", label: t.necessary, text: t.necessaryText, checked: true, disabled: true },
            { key: "analytics", label: t.analytics, text: t.analyticsText, checked: choice.analytics, disabled: false },
            { key: "marketing", label: t.marketing, text: t.marketingText, checked: choice.marketing, disabled: false },
          ].map((c) => (
            <label key={c.key} className="flex min-h-11 cursor-pointer items-start gap-3 border-b border-rule py-2.5">
              <input type="checkbox" checked={c.checked} disabled={c.disabled} onChange={(e) => setChoice({ ...choice, [c.key]: e.target.checked })} className="mt-1 h-5 w-5 shrink-0 accent-brand disabled:cursor-not-allowed" />
              <span>
                <span className="block font-semibold text-ink">{c.label}</span>
                <span className="text-[0.86rem] leading-snug">{c.text}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <div className="mt-3.5 flex flex-wrap gap-2">
        <button type="button" className="btn-primary btn-sm min-h-11 flex-1 px-3 whitespace-nowrap" onClick={() => save({ analytics: true, marketing: true })}>
          {t.acceptAll}
        </button>
        <button type="button" className="btn-secondary btn-sm min-h-11 flex-1 px-3 whitespace-nowrap" onClick={() => save({ analytics: false, marketing: false })}>
          {t.necessaryOnly}
        </button>
        {details ? (
          <button type="button" className="btn-secondary btn-sm min-h-11 flex-1 px-3 whitespace-nowrap" onClick={() => save(choice)}>
            {t.save}
          </button>
        ) : (
          <button type="button" className="btn-ghost btn-sm min-h-11 px-3 whitespace-nowrap" onClick={() => setDetails(true)}>
            {t.settings}
          </button>
        )}
      </div>
    </div>
  );
}

/** Link "Cookie-instellingen" in de footer: opent de melding opnieuw met de keuzes per categorie. */
export function CookieSettingsButton({ label, className = "" }: { label: string; className?: string }) {
  return (
    <button type="button" className={`inline-flex min-h-10 cursor-pointer items-center underline-offset-4 hover:text-brand hover:underline ${className}`} onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>
      {label}
    </button>
  );
}
