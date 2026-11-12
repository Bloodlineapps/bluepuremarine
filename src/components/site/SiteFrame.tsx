import { pathOf } from "@/lib/content";
import { getSite } from "@/lib/settings";
import { CookieConsent } from "./CookieConsent";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { Reveal } from "./Reveal";
import { WhatsAppButton } from "./WhatsAppButton";

/**
 * Vaste opbouw van elke publieke pagina: skiplink, header, één <main id="main">, footer, cookiemelding en de
 * WhatsApp-knop. De layout van de webshop gebruikt dit; pagina's leveren alleen de inhoud binnen <main>.
 * (De voorbeeldweergave in het beheer gebruikt dit ook; `locale` en `translations` komen nog uit de tweetalige
 * basis en worden genegeerd.)
 */
export async function SiteFrame({ children }: { children: React.ReactNode; locale?: string; translations?: unknown }) {
  const [site, cookies] = await Promise.all([getSite(), pathOf("cookies")]);
  return (
    <>
      <a href="#main" className="sr-only z-[100] rounded-lg bg-navy px-5 py-3 font-bold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Naar de inhoud
      </a>
      <Header />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
      <Reveal />
      {site.whatsapp && <WhatsAppButton number={site.whatsapp} text={site.whatsappText} hours={site.serviceHours} />}
      <CookieConsent cookiesHref={cookies} />
    </>
  );
}
