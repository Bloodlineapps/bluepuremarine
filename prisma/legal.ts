// Concepttekst voor de juridische pagina's die op de oude site ontbraken of niet meer kloppen voor de nieuwe webshop:
//   - privacyverklaring: de oude tekst was het standaard Shopify-beleid (noemt Shopify als verwerker) en past niet bij
//     de nieuwe site; hier staat een nieuwe verklaring op basis van wat deze site echt doet;
//   - cookieverklaring: bestond niet; met de cookies die deze site zelf plaatst;
//   - aanvulling op de algemene voorwaarden: herroepingsrecht en consumentenbepalingen voor de webwinkel (de oude
//     "servicevoorwaarden" gaan vooral over dienstverlening aan opdrachtgevers).
// Bedrijfsgegevens komen van de oude site. Alles in dit bestand moet juridisch gecontroleerd worden (isDraftCopy).

export type LegalSection = { heading: string; html: string };
export type LegalPage = { key: "privacy" | "cookies"; path: string; title: string; navTitle: string; intro: string; metaTitle: string; metaDescription: string; sections: LegalSection[] };

export const DRAFT_NOTE = "<p><strong>Concept.</strong> Deze tekst is opgesteld bij de vernieuwing van de webwinkel en moet nog juridisch worden gecontroleerd.</p>";

const COMPANY = '<p>BluePure Marine<br>Herman Boerhaavestraat 18<br>5165 EG Waspik<br>Nederland</p><p>E-mail: <a href="mailto:info@bluepuremarine.com">info@bluepuremarine.com</a><br>Telefoon: <a href="tel:+31611791623">+31 6 11791623</a><br>KvK: 42077731<br>Btw: NL005476895B23</p>';

export const LEGAL: LegalPage[] = [
  {
    key: "privacy",
    path: "/privacy/",
    title: "Privacyverklaring",
    navTitle: "Privacy",
    intro: "In deze verklaring lees je welke persoonsgegevens BluePure Marine via deze webwinkel verwerkt, waarom we dat doen, hoe lang we ze bewaren en welke rechten je hebt.",
    metaTitle: "Privacyverklaring van de webwinkel | BluePure Marine",
    metaDescription: "Lees welke persoonsgegevens BluePure Marine verwerkt bij een bestelling, account of contactverzoek, hoe lang we ze bewaren en welke rechten je hebt.",
    sections: [
      { heading: "Wie is verantwoordelijk", html: `${DRAFT_NOTE}<p>BluePure Marine is verantwoordelijk voor de verwerking van persoonsgegevens via www.bluepuremarine.com.</p>${COMPANY}` },
      {
        heading: "Welke gegevens we verwerken",
        html: "<ul><li><strong>Bestelgegevens:</strong> je naam, e-mailadres, telefoonnummer, bezorg- en factuuradres, de bestelde producten, het orderbedrag en de status van je bestelling en betaling.</li><li><strong>Accountgegevens:</strong> als je een account aanmaakt bewaren we je naam, e-mailadres, adressen en een versleutelde vorm van je wachtwoord. Je wachtwoord zelf kunnen wij niet inzien.</li><li><strong>Contactgegevens:</strong> wat je invult in het contactformulier of ons per e-mail, telefoon of WhatsApp stuurt.</li><li><strong>Reviews:</strong> je naam, je beoordeling en je tekst als je een review plaatst.</li><li><strong>Nieuwsbrief:</strong> je e-mailadres als je je daarvoor aanmeldt.</li><li><strong>Technische gegevens:</strong> gegevens die nodig zijn om de website veilig te laten werken, zoals je IP-adres in serverlogboeken.</li><li><strong>Statistieken:</strong> alleen na jouw toestemming, gegevens over het gebruik van de website via Google Analytics.</li></ul><p>Betaalgegevens zoals je rekening- of kaartnummer vul je in bij de betaaldienst. Wij ontvangen alleen of de betaling is gelukt en met welke betaalmethode.</p>",
      },
      {
        heading: "Waarvoor en op welke grondslag",
        html: "<ul><li>Je bestelling verwerken, bezorgen en je daarover informeren: uitvoering van de koopovereenkomst.</li><li>Je account beheren: uitvoering van de overeenkomst.</li><li>Je vraag of klacht beantwoorden en retouren afhandelen: uitvoering van de overeenkomst en ons gerechtvaardigd belang bij goede service.</li><li>Onze administratie voeren en facturen bewaren: wettelijke verplichting.</li><li>De nieuwsbrief versturen: jouw toestemming, die je altijd kunt intrekken via de afmeldlink of door ons te mailen.</li><li>De website beveiligen en misbruik tegengaan: gerechtvaardigd belang.</li><li>Websitestatistieken bijhouden: jouw toestemming, die je kunt wijzigen via Cookie-instellingen onderaan elke pagina.</li></ul>",
      },
      {
        heading: "Hoe lang we gegevens bewaren",
        html: "<ul><li>Bestellingen en facturen: zeven jaar, vanwege de fiscale bewaarplicht.</li><li>Accountgegevens: zolang je account bestaat. Je kunt ons vragen je account te verwijderen.</li><li>Contactverzoeken: maximaal twaalf maanden na het laatste contact, tenzij ze bij een bestelling horen.</li><li>Nieuwsbriefaanmelding: tot je je afmeldt.</li><li>Serverlogboeken: korte tijd, daarna worden ze automatisch verwijderd.</li></ul>",
      },
      {
        heading: "Met wie we gegevens delen",
        html: "<p>We verkopen je gegevens nooit. We delen ze alleen met partijen die nodig zijn om de webwinkel te laten werken en je bestelling te leveren:</p><ul><li>de betaaldienst (Mollie) voor het afhandelen van je betaling;</li><li>de vervoerder die je pakket bezorgt (naam, adres en waar nodig je telefoonnummer of e-mailadres voor de bezorgmelding);</li><li>de e-maildienst waarmee we bestelbevestigingen en formuliermeldingen versturen;</li><li>de hostingpartij van de website en de database;</li><li>Google (Analytics of Tag Manager), alleen na jouw toestemming;</li><li>onze boekhouder en de Belastingdienst, voor zover dat wettelijk verplicht is.</li></ul><p>Met partijen die gegevens voor ons verwerken sluiten we een verwerkersovereenkomst.</p>",
      },
      { heading: "Doorgifte buiten de EER", html: "<p>Sommige dienstverleners kunnen gegevens verwerken buiten de Europese Economische Ruimte, bijvoorbeeld in de Verenigde Staten. In dat geval zorgen we voor passende waarborgen, zoals een adequaatheidsbesluit (EU-US Data Privacy Framework) of de standaardcontractbepalingen van de Europese Commissie.</p>" },
      { heading: "Beveiliging", html: "<p>De website gebruikt een versleutelde verbinding (https). Wachtwoorden worden alleen versleuteld opgeslagen. Bestellingen en formulierinzendingen staan in een afgeschermde omgeving die alleen bevoegde medewerkers met een persoonlijk account kunnen inzien.</p>" },
      {
        heading: "Jouw rechten",
        html: '<p>Je hebt het recht op inzage, correctie en verwijdering van je gegevens, op beperking van de verwerking, op overdraagbaarheid en het recht om bezwaar te maken. Een deel van je gegevens kun je zelf inzien en aanpassen in je account. Voor andere verzoeken mail je naar <a href="mailto:info@bluepuremarine.com">info@bluepuremarine.com</a>; we reageren binnen een maand.</p><p>Ben je het niet eens met hoe wij met je gegevens omgaan, dan kun je een klacht indienen bij de <a href="https://autoriteitpersoonsgegevens.nl/">Autoriteit Persoonsgegevens</a>.</p>',
      },
      { heading: "Cookies", html: '<p>Welke cookies deze website plaatst, lees je in de <a href="/cookies/">cookieverklaring</a>.</p>' },
      { heading: "Wijzigingen", html: "<p>We kunnen deze privacyverklaring aanpassen als onze webwinkel of de wetgeving verandert. De actuele versie staat altijd op deze pagina.</p>" },
    ],
  },
  {
    key: "cookies",
    path: "/cookies/",
    title: "Cookieverklaring",
    navTitle: "Cookies",
    intro: "Deze webwinkel gebruikt een klein aantal cookies. De meeste zijn nodig om te kunnen bestellen; statistieken plaatsen we alleen als jij daar toestemming voor geeft.",
    metaTitle: "Cookieverklaring van de webwinkel | BluePure Marine",
    metaDescription: "Welke cookies plaatst de webwinkel van BluePure Marine? Een overzicht van de functionele cookies en van de statistieken die alleen na jouw toestemming laden.",
    sections: [
      { heading: "Wat zijn cookies", html: `${DRAFT_NOTE}<p>Cookies zijn kleine tekstbestanden die een website in je browser opslaat. Daarmee onthoudt de website bijvoorbeeld wat er in je winkelwagen ligt of dat je bent ingelogd.</p>` },
      {
        heading: "Functionele cookies",
        html: "<p>Deze cookies zijn nodig om de webwinkel te laten werken. Daarvoor is geen toestemming nodig.</p><table><thead><tr><th>Cookie</th><th>Doel</th><th>Bewaartermijn</th></tr></thead><tbody><tr><td>bpm_cart</td><td>Onthoudt je winkelwagen. De bijbehorende cookie bpm_cart_n bevat alleen het aantal artikelen voor het winkelwagen-icoon.</td><td>30 dagen</td></tr><tr><td>bpm_customer</td><td>Houdt je ingelogd in je klantaccount. De bijbehorende cookie bpm_customer_n bevat alleen je voornaam voor de begroeting in de header.</td><td>30 dagen</td></tr><tr><td>bpm_admin</td><td>Houdt medewerkers ingelogd in het beheer van de website. Wordt alleen geplaatst na inloggen in het beheer.</td><td>8 uur</td></tr><tr><td>bpm_consent</td><td>Onthoudt je keuze in de cookiemelding.</td><td>12 maanden</td></tr></tbody></table>",
      },
      {
        heading: "Statistieken (alleen na toestemming)",
        html: "<p>Als je in de cookiemelding toestemming geeft voor statistieken, laden we Google Analytics, rechtstreeks of via Google Tag Manager. Zonder toestemming worden deze cookies niet geplaatst.</p><table><thead><tr><th>Cookie</th><th>Aanbieder</th><th>Doel</th><th>Bewaartermijn</th></tr></thead><tbody><tr><td>_ga</td><td>Google Analytics</td><td>Onderscheidt bezoekers om het gebruik van de website te meten.</td><td>Maximaal 2 jaar</td></tr><tr><td>_ga_&lt;id&gt;</td><td>Google Analytics</td><td>Houdt de sessie bij voor de statistieken.</td><td>Maximaal 2 jaar</td></tr></tbody></table><p>Google Tag Manager plaatst zelf geen cookies, maar laadt de scripts waarvoor je toestemming hebt gegeven.</p>",
      },
      { heading: "Betalen", html: "<p>Tijdens het afrekenen ga je naar de omgeving van de betaaldienst (Mollie) of van je bank. Die partijen kunnen daar hun eigen cookies plaatsen; daarop is hun eigen cookie- en privacybeleid van toepassing.</p>" },
      { heading: "Je keuze wijzigen", html: "<p>Je kunt je keuze altijd aanpassen via Cookie-instellingen onderaan elke pagina. Cookies die al geplaatst zijn, verwijder je via de instellingen van je browser. Zonder functionele cookies kun je geen bestelling plaatsen.</p>" },
      { heading: "Vragen", html: '<p>Heb je een vraag over cookies of over je gegevens? Mail naar <a href="mailto:info@bluepuremarine.com">info@bluepuremarine.com</a> of lees de <a href="/privacy/">privacyverklaring</a>.</p>' },
    ],
  },
];

/** Aanvulling op de algemene voorwaarden van de oude site: bepalingen voor consumenten die via de webwinkel bestellen. */
export const TERMS_SUPPLEMENT: LegalSection[] = [
  {
    heading: "Aanvulling voor bestellingen via de webwinkel",
    html: `${DRAFT_NOTE}<p>De artikelen hierboven zijn de servicevoorwaarden zoals ze op de oude website stonden. De artikelen 14 tot en met 17 hieronder zijn nieuw en gelden voor consumenten die via de webwinkel bestellen. Waar ze afwijken van de artikelen hierboven, gaan voor consumenten de artikelen 14 tot en met 17 voor. Dwingende consumentenwetgeving blijft altijd van toepassing.</p>`,
  },
  {
    heading: "Artikel 14 – Prijzen en bestellen in de webwinkel",
    html: "<ol><li>De prijzen in de webwinkel zijn in euro en inclusief btw. Verzendkosten zie je in de winkelwagen en bij het afrekenen, voordat je de bestelling afrondt.</li><li>De overeenkomst komt tot stand zodra je de bestelling hebt geplaatst en wij die per e-mail hebben bevestigd.</li><li>Je betaalt bij het bestellen met een van de betaalmethoden die bij het afrekenen worden aangeboden.</li></ol>",
  },
  {
    heading: "Artikel 15 – Herroepingsrecht",
    html: '<ol><li>Als consument mag je een aankoop binnen 14 dagen zonder opgave van redenen ontbinden. De termijn gaat in op de dag nadat jij, of iemand die je daarvoor hebt aangewezen, het product hebt ontvangen. Bestaat je bestelling uit meerdere leveringen, dan gaat de termijn in na ontvangst van het laatste product.</li><li>Je meldt de herroeping binnen deze termijn bij ons, bijvoorbeeld per e-mail aan <a href="mailto:info@bluepuremarine.com">info@bluepuremarine.com</a> of via het <a href="/contact/">contactformulier</a>, onder vermelding van je ordernummer. Je mag daarvoor ook het Europese modelformulier voor herroeping gebruiken.</li><li>Na je melding stuur je het product binnen 14 dagen terug. De kosten van het terugsturen zijn voor jouw rekening, tenzij we iets anders afspreken.</li><li>Tijdens de bedenktijd ga je zorgvuldig om met het product en de verpakking. Je mag het product alleen uitpakken en bekijken zoals je dat in een winkel zou doen. Is het product meer gebruikt dan daarvoor nodig is, dan kunnen we de waardevermindering in rekening brengen.</li><li>We betalen het aankoopbedrag, inclusief de kosten van de standaardverzending van de heenzending, binnen 14 dagen na je melding terug. We mogen wachten met terugbetalen tot we het product terug hebben of tot je hebt aangetoond dat je het hebt teruggestuurd. Terugbetalen doen we met dezelfde betaalmethode als waarmee je hebt betaald.</li></ol>',
  },
  {
    heading: "Artikel 16 – Uitzonderingen op het herroepingsrecht",
    html: "<ol><li>Het herroepingsrecht geldt niet voor verzegelde producten die om redenen van gezondheidsbescherming of hygiëne niet geschikt zijn om te worden teruggezonden en waarvan de verzegeling na levering is verbroken.</li><li>Het herroepingsrecht geldt niet voor producten die volgens jouw specificaties zijn gemaakt of besteld.</li><li>Het herroepingsrecht geldt alleen voor consumenten, niet voor aankopen in de uitoefening van een beroep of bedrijf.</li></ol>",
  },
  {
    heading: "Artikel 17 – Conformiteit en klachten van consumenten",
    html: '<ol><li>Een product moet voldoen aan wat je er op grond van de overeenkomst van mag verwachten. Als consument heb je daarbij altijd recht op de wettelijke garantie (conformiteit).</li><li>Is je bestelling beschadigd of niet compleet, meld het dan zo snel mogelijk, bij voorkeur binnen 7 dagen na levering, met je ordernummer en zo mogelijk een foto. Een latere melding laat je wettelijke rechten onverlet.</li><li>Klachten kun je melden via <a href="mailto:info@bluepuremarine.com">info@bluepuremarine.com</a>. We reageren zo snel mogelijk. Komen we er samen niet uit, dan kun je het geschil voorleggen aan de bevoegde rechter.</li></ol>',
  },
];
