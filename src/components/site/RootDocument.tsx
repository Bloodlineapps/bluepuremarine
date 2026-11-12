import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Rubik } from "next/font/google";
import { Ga4Head, GA4_ID } from "@/components/site/Ga4";
import { GTM_ID, GtmBody, GtmHead } from "@/components/site/Gtm";
import { JsonLd } from "@/components/site/JsonLd";
import { graph, organizationLd } from "@/lib/seo";
import { BRAND, SITE_URL, getConnections, getSeo, getSite } from "@/lib/settings";

// <html>-document van de publieke webshop: lettertypes (Rubik voor tekst, Barlow Condensed voor bannerkoppen),
// GTM/GA4 alleen als de connectie aan staat (met Consent Mode v2: pas meten na toestemming) en de
// Organization + WebSite structured data op elke pagina.

const body = Rubik({ subsets: ["latin"], variable: "--font-body-src", display: "swap" });
const display = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-display-src", display: "swap" });

export async function siteMetadata(): Promise<Metadata> {
  const [seo, c] = await Promise.all([getSeo(), getConnections()]);
  return {
    metadataBase: new URL(SITE_URL),
    applicationName: BRAND,
    icons: { icon: "/icon.png", apple: "/apple-touch-icon.png" },
    formatDetection: { telephone: false },
    verification: { ...(c.gsc.enabled && c.gsc.verification ? { google: c.gsc.verification } : {}), ...(seo.bingVerification ? { other: { "msvalidate.01": seo.bingVerification } } : {}) },
  };
}

export const siteViewport: Viewport = { themeColor: "#0a1a33", width: "device-width", initialScale: 1 };

/** Extra code uit Connecties → Tag Manager (tekstvak): als HTML-fragment invoegen, scripts worden dan ook uitgevoerd. */
function ExtraCode({ html, target }: { html: string; target: "head" | "body" }) {
  if (!html.trim()) return null;
  const js = `(function(){var f=document.createRange().createContextualFragment(${JSON.stringify(html).replace(/</g, "\\u003c")});document.${target}.${target === "head" ? "appendChild(f)" : "insertBefore(f,document.body.firstChild)"};})();`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}

export async function RootDocument({ children }: { children: React.ReactNode; locale?: string }) {
  const [connections, site] = await Promise.all([getConnections(), getSite()]);
  const gtm = connections.gtm.enabled && GTM_ID.test(connections.gtm.containerId) ? connections.gtm.containerId : null;
  const ga4 = !gtm && connections.ga4.enabled && GA4_ID.test(connections.ga4.measurementId) ? connections.ga4.measurementId : null;
  return (
    <html lang="nl" className={`${display.variable} ${body.variable}`}>
      <head>
        {gtm && <GtmHead id={gtm} />}
        {gtm && <ExtraCode html={connections.gtm.headCode} target="head" />}
        {ga4 && <Ga4Head id={ga4} />}
        {/* zonder JavaScript zijn secties die bij scrollen infaden gewoon zichtbaar */}
        <noscript>
          <style>{`.reveal{opacity:1!important;transform:none!important}`}</style>
        </noscript>
      </head>
      <body className="flex min-h-dvh flex-col">
        {gtm && <GtmBody id={gtm} />}
        {gtm && <ExtraCode html={connections.gtm.bodyCode} target="body" />}
        <JsonLd data={graph(organizationLd(site))} />
        {children}
      </body>
    </html>
  );
}
