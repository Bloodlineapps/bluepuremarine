"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Accountlink in de header. Leest de leesbare cookie `bpm_customer_n` (alleen de voornaam; de echte sessie staat in
// een httpOnly-cookie): ingelogd → "Hallo <naam>" naar /account/, anders "Inloggen".

function readName() {
  const m = /(?:^|;\s*)bpm_customer_n=([^;]*)/.exec(document.cookie);
  if (!m) return "";
  try {
    return decodeURIComponent(m[1]).slice(0, 40);
  } catch {
    return "";
  }
}

export function AccountLink() {
  const [name, setName] = useState<string | null>(null);
  // na inloggen of uitloggen verandert de pagina: dan de cookie opnieuw lezen
  const pathname = usePathname();
  useEffect(() => {
    const update = () => setName(readName());
    update();
    window.addEventListener("customer:changed", update);
    window.addEventListener("focus", update);
    return () => {
      window.removeEventListener("customer:changed", update);
      window.removeEventListener("focus", update);
    };
  }, [pathname]);

  const loggedIn = !!name;
  return (
    <Link href={loggedIn ? "/account/" : "/account/inloggen/"} className="group inline-flex min-h-11 items-center gap-2.5 rounded-lg px-1.5 py-1 text-current transition-colors hover:text-brand" aria-label={loggedIn ? `Mijn account, ingelogd als ${name}` : "Inloggen"}>
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand transition-colors group-hover:bg-brand group-hover:text-white">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" />
        </svg>
      </span>
      <span className="hidden text-left leading-tight lg:block" aria-hidden="true">
        <span className="block text-xs font-medium opacity-80">{loggedIn ? `Hallo ${name}` : "Mijn account"}</span>
        <span className="block text-sm font-bold">{loggedIn ? "Mijn account" : "Inloggen"}</span>
      </span>
    </Link>
  );
}
