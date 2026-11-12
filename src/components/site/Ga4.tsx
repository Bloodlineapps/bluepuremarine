// Google Analytics 4 rechtstreeks (alleen als Tag Manager uit staat), met Consent Mode v2: standaard alles
// "denied"; pas na toestemming via de cookiemelding (cookie bpm_consent) wordt analytics_storage "granted".
export const GA4_ID = /^G-[A-Z0-9]{6,12}$/;

export function Ga4Head({ id }: { id: string }) {
  const js = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',functionality_storage:'granted',security_storage:'granted',wait_for_update:500});
try{var m=document.cookie.match(/bpm_consent=([^;]+)/);if(m){var c=JSON.parse(decodeURIComponent(m[1]));gtag('consent','update',{analytics_storage:c.analytics?'granted':'denied',ad_storage:c.marketing?'granted':'denied',ad_user_data:c.marketing?'granted':'denied',ad_personalization:c.marketing?'granted':'denied'});}}catch(e){}
gtag('js',new Date());gtag('config','${id}',{anonymize_ip:true});`;
  return (
    <>
      <script async src={`https://www.googletagmanager.com/gtag/js?id=${id}`} />
      <script id="ga4" dangerouslySetInnerHTML={{ __html: js }} />
    </>
  );
}
