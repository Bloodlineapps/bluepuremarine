"use client";
import { useEffect, useRef, useState } from "react";
import { dict, fmt } from "@/lib/i18n";
import { WhatsAppIcon } from "./icons";

/**
 * WhatsApp Business-chatknop rechtsonder: ronde groene knop met zachte puls. Een klik opent een kaartje met korte
 * uitleg en de knop "Start chat" (wa.me-link met het klaargezette bericht, in een nieuw tabblad). Op pagina's met
 * een vaste koopbalk onderaan (data-buybar) schuift de knop op mobiel omhoog — zie .wa-fab in globals.css.
 */
export function WhatsAppButton({ number, text, hours }: { number: string; text: string; hours: string }) {
  const t = dict("nl").whatsapp;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, [open]);

  const digits = number.replace(/\D/g, "");
  if (!digits) return null;
  const href = `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

  return (
    <div ref={ref} className="wa-fab fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-3 print:hidden sm:bottom-6 sm:right-6">
      {open && (
        <div id="wa-card" role="dialog" aria-labelledby="wa-title" className="w-[min(19rem,calc(100vw-2rem))] animate-pop overflow-hidden rounded-card border border-rule bg-sheet shadow-lift">
          <div className="flex items-center gap-3 bg-whatsapp px-4 py-3 text-navy-900">
            <WhatsAppIcon className="h-7 w-7 shrink-0" />
            <p id="wa-title" className="font-bold leading-tight">
              {t.title}
            </p>
          </div>
          <div className="p-4">
            <p className="text-[0.95rem]">{t.text}</p>
            {hours && <p className="mt-2 text-[0.88rem] text-muted">{fmt(t.hours, { hours })}</p>}
            <a href={href} target="_blank" rel="noopener noreferrer" className="btn mt-4 w-full bg-whatsapp text-navy-900 hover:shadow-card">
              <WhatsAppIcon className="h-5 w-5" />
              {t.start}
              <span className="sr-only"> (opent in nieuw tabblad)</span>
            </a>
          </div>
        </div>
      )}
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="wa-card" aria-label={open ? t.close : t.open} className="grid h-14 w-14 animate-ring cursor-pointer place-items-center rounded-full bg-whatsapp text-white shadow-lift transition-transform duration-200 hover:scale-110">
        <WhatsAppIcon className="h-8 w-8" />
      </button>
    </div>
  );
}
