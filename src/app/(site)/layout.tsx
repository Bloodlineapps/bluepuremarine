import "../globals.css";
import { RootDocument, siteMetadata, siteViewport } from "@/components/site/RootDocument";
import { SiteFrame } from "@/components/site/SiteFrame";

// Root-layout van de publieke webshop: <html lang="nl">, lettertypes, GTM/GA4 (na toestemming), structured data van
// de organisatie en de vaste opbouw (skiplink, header, <main id="main">, footer, cookiemelding, WhatsApp-knop).
// Pagina's — ook winkelwagen, afrekenen en account — leveren alleen de inhoud binnen <main>.
export const generateMetadata = siteMetadata;
export const viewport = siteViewport;

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <RootDocument>
      <SiteFrame>{children}</SiteFrame>
    </RootDocument>
  );
}
