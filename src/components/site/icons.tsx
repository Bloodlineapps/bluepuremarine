// Extra iconen voor de webshop die niet in de gedeelde Icon-set zitten (inline SVG, geen externe bestanden).
// Allemaal decoratief (aria-hidden); de omliggende link of knop heeft de tekst.

type P = { className?: string };

export function WhatsAppIcon({ className = "h-6 w-6" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path d="M12 2.5a9.5 9.5 0 0 0-8.2 14.3L2.6 21.4l4.7-1.2A9.5 9.5 0 1 0 12 2.5z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path
        fill="currentColor"
        d="M8.7 7.4c.2-.4.4-.5.7-.5h.5c.2 0 .4.1.6.5l.7 1.7c.1.3.1.5-.1.7l-.5.7c-.2.2-.2.4 0 .6.5.8 1.6 1.9 2.7 2.4.2.1.4.1.6-.1l.7-.9c.2-.2.4-.3.7-.1l1.7.8c.3.1.4.3.4.5 0 .8-.5 1.7-1.4 2-.9.3-2.100.1-3.800-.8-2-1.100-3.800-3.200-4.300-4.800-.300-1.100-.100-2.100.800-2.700z"
      />
    </svg>
  );
}

export function GoogleG({ className = "h-5 w-5" }: P) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function TruckIcon({ className = "h-5 w-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M2 6h11v10H2zM13 9h4.5L21 12.5V16h-8zM6.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
    </svg>
  );
}

export function XIcon({ className = "h-5 w-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M17.6 3h3.1l-6.800 7.700L22 21h-6.300l-4.900-6.400L5.200 21H2.100l7.200-8.300L1.700 3h6.400l4.400 5.900zm-1.100 16.100h1.700L7.200 4.800H5.400z" />
    </svg>
  );
}

export function LinkedInIcon({ className = "h-5 w-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M4.500 3A1.800 1.800 0 1 0 4.500 6.600 1.800 1.800 0 0 0 4.500 3zM3 8.500h3V21H3zM9 8.500h2.900v1.700c.5-.9 1.700-2 3.600-2 3.300 0 4.500 2.100 4.500 5.300V21h-3v-6.600c0-1.600-.500-2.800-2.100-2.800-1.700 0-2.400 1.200-2.400 2.800V21H9z" />
    </svg>
  );
}

/** Golf als decoratie onderin een banner of band (kleur via currentColor). */
export function Wave({ className = "" }: P) {
  return (
    <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className={className} aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M0 60c150-50 300-50 450 0s300 50 450 0 200-45 300-20v80H0z" />
    </svg>
  );
}

const badge = "inline-flex h-8 min-w-[3.4rem] items-center justify-center rounded-md border border-rule bg-sheet px-2 text-[0.72rem] font-extrabold leading-none";

/** Betaalmethoden als nette tekst-badges (geen externe logo-bestanden). */
export function PaymentBadges() {
  return (
    <ul className="flex flex-wrap items-center gap-2" aria-label="Betaalmethoden">
      <li className={`${badge} text-ink`}>
        <span className="text-[#cc0066]">i</span>DEAL
      </li>
      <li className={`${badge} italic tracking-wide text-[#1a1f71]`}>VISA</li>
      <li className={`${badge} gap-1.5 font-bold text-ink`}>
        <svg viewBox="0 0 28 18" className="h-4 w-6" aria-hidden="true" focusable="false">
          <circle cx="9" cy="9" r="8" fill="#eb001b" />
          <circle cx="19" cy="9" r="8" fill="#f79e1b" fillOpacity="0.9" />
        </svg>
        Mastercard
      </li>
      <li className={`${badge} italic text-[#003087]`}>
        Pay<span className="text-[#0070ba]">Pal</span>
      </li>
      <li className={`${badge} text-[#005498]`}>Bancontact</li>
    </ul>
  );
}
