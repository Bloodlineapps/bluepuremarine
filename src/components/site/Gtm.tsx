// Google Tag Manager met Consent Mode v2. Alleen geladen als de connectie in /admin/connecties/ aan staat;
// nooit in het beheer (dat heeft een eigen root-layout zonder deze component). Standaard staat alles op "denied";
// een eerder gemaakte keuze (cookie bpm_consent) wordt direct toegepast, daarna pas laadt de container.
export const GTM_ID = /^GTM-[A-Z0-9]{4,10}$/;

export function GtmHead({ id }: { id: string }) {
  const js = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',functionality_storage:'granted',security_storage:'granted',wait_for_update:500});
try{var m=document.cookie.match(/bpm_consent=([^;]+)/);if(m){var c=JSON.parse(decodeURIComponent(m[1]));gtag('consent','update',{analytics_storage:c.analytics?'granted':'denied',ad_storage:c.marketing?'granted':'denied',ad_user_data:c.marketing?'granted':'denied',ad_personalization:c.marketing?'granted':'denied'});}}catch(e){}
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${id}');`;
  return <script id="gtm" dangerouslySetInnerHTML={{ __html: js }} />;
}

export function GtmBody({ id }: { id: string }) {
  return (
    <noscript>
      <iframe src={`https://www.googletagmanager.com/ns.html?id=${id}`} height="0" width="0" style={{ display: "none", visibility: "hidden" }} title="Google Tag Manager" />
    </noscript>
  );
}
