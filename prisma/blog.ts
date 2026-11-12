// Drie blogartikelen voor de categorie "Onderhoudstips". Cijfers over producten (inwerktijden, stuwkracht, tunneldiameter,
// spanning) komen uit de specificaties van de producten in de shop; de overige adviezen zijn algemene onderhoudspraktijk.
// Interne links verwijzen naar bestaande categorie- en productpagina's (de seed controleert dat).

export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  image: string;
  imageAlt: string;
  tags: string[];
  metaTitle: string;
  metaDescription: string;
  publishedAt: string;
  content: string;
};

export const BLOG_CATEGORY = { slug: "onderhoudstips", name: "Onderhoudstips" };

export const POSTS: BlogPost[] = [
  {
    slug: "boot-winterklaar-maken",
    title: "Boot winterklaar maken: schoonmaken, schimmel voorkomen en techniek nalopen",
    excerpt: "Een boot die schoon, droog en technisch nagelopen de winter in gaat, komt in het voorjaar zonder verrassingen terug. Zo pak je het aan, in vier stappen.",
    image: "/uploads/home/jacht.webp",
    imageAlt: "Motorjacht op het water aan het eind van het vaarseizoen",
    tags: ["winterstalling", "reinigen", "schimmel", "motor"],
    metaTitle: "Boot winterklaar maken in vier stappen | BluePure Marine",
    metaDescription: "Boot winterklaar maken? Zo reinig je romp en interieur, voorkom je schimmel in de winterstalling en loop je motor, drinkwatersysteem en schroef na.",
    publishedAt: "2026-11-03T08:00:00.000Z",
    content: `<p>Een boot die schoon, droog en technisch nagelopen de winter in gaat, komt in het voorjaar zonder verrassingen weer tevoorschijn. Vuil dat maandenlang blijft zitten, trekt in gelcoat en bekleding. Vocht geeft schimmel. En water dat in leidingen achterblijft, kan bij vorst schade aanrichten. In dit artikel lopen we de klus in vier stappen door: de buitenkant, het interieur, de techniek en de schroef.</p>
<h2>1. Maak de buitenkant schoon voordat het zeil erop gaat</h2>
<p>Algenaanslag, zoutresten en zwarte strepen verdwijnen niet vanzelf onder een dekzeil. Integendeel: onder een zeil blijft vuil lang vochtig en krijgt het alle tijd om in te trekken. Reinig romp, waterlijn en dek daarom nog één keer grondig voordat je de boot afdekt of de loods in rijdt.</p>
<p>Met de <a href="/producten/exterior-cleaner/">Exterior cleaner</a> werk je zo:</p>
<ol>
<li>Breng de reiniger gelijkmatig aan. Gebruik hem puur bij zware vervuiling en verdund bij lichte vervuiling.</li>
<li>Laat hem ongeveer een minuut inwerken. Laat het middel niet opdrogen, en werk dus niet in de volle zon.</li>
<li>Borstel het oppervlak met een scheepsborstel.</li>
<li>Spoel grondig na met ruim water, tot alle resten weg zijn.</li>
</ol>
<p>Werk in vlakken van een paar vierkante meter, zodat je altijd kunt afspoelen voordat de reiniger droogt. Vergeet de plekken niet waar vuil zich ophoopt: onder de stootrand, rond de klampen en in de antislipprofielen van het dek. Wil je de romp in het voorjaar in de was zetten? Dan heb je nu alvast een schone ondergrond, en daarop hecht een wax of coating beter.</p>
<h2>2. Interieur: schoon, leeg en vooral droog</h2>
<h3>Eerst schoonmaken</h3>
<p>Kruimels, vetvlekken en zoutaanslag zijn een voedingsbodem voor schimmel. Neem daarom alle oppervlakken in kajuit, kombuis en stuurhut af. Spray de Interior cleaner op een microvezeldoek of direct op het oppervlak, veeg het schoon en wrijf na met de droge kant van de doek. Op beeldschermen en instrumenten spray je nooit rechtstreeks: daar breng je het middel aan via de doek.</p>
<h3>Daarna schimmel voorkomen</h3>
<p>Schimmel heeft vocht en stilstaande lucht nodig. Haal je één van die twee weg, dan krijgt hij weinig kans:</p>
<ul>
<li>Neem kussens, beddengoed, handdoeken en reddingsvesten mee naar huis, of zet kussens rechtop zodat er lucht langs kan.</li>
<li>Zet kastjes, vloerluiken en de deur van de koelkast open.</li>
<li>Maak de bilge droog en haal natte spullen uit de bakskisten.</li>
<li>Houd ventilatieopeningen vrij en span het dekzeil zo dat er lucht onderdoor kan.</li>
<li>Zet een vochtvreter neer en ga in de winter af en toe kijken.</li>
</ul>
<p>Zie je toch al zwarte puntjes of weerplekken op bekleding, plafond of zeildoek? Behandel die vóór de winter met de <a href="/producten/mold-remover/">Mold remover</a>. Test het middel eerst op een onopvallende plek op kleurechtheid. Spray het op de vlek, laat het vijf tot tien minuten inwerken, werk het vuil los met een zachte borstel of spons en neem het oppervlak daarna af met een schone, vochtige doek. Laat alles met de luiken open goed drogen.</p>
<h2>3. Motor en systemen nalopen</h2>
<p>Elke motor is anders. Houd daarom altijd het handboek van de fabrikant aan, of laat het werk doen door je werf of monteur. Dit zijn de punten die bij vrijwel elke boot terugkomen:</p>
<ul>
<li><strong>Koelsysteem.</strong> Water dat bevriest, zet uit. In het koelsysteem mag dus geen onbeschermd water achterblijven: aftappen of doorspoelen met antivries, volgens het voorschrift van de motorfabrikant.</li>
<li><strong>Olie en filters.</strong> Ververs de olie vóór de winter, zodat oude olie met vocht en verbrandingsresten niet maandenlang in de motor staat.</li>
<li><strong>Brandstof.</strong> In een volle dieseltank is minder ruimte voor condens dan in een halflege.</li>
<li><strong>Accu's.</strong> Laad ze vol, koppel ze los of laad ze in de winter af en toe bij.</li>
<li><strong>Drinkwatersysteem.</strong> Tap de tank, de leidingen en de boiler af en laat de waterpomp leeglopen.</li>
</ul>
<p>Maak meteen de motorruimte en de bilge schoon. In een schone bilge zie je in het voorjaar direct of er ergens olie of water lekt. Breng de <a href="/producten/oil-remover/">Oil remover</a> onverdund aan, laat hem drie tot vijf minuten inwerken zonder dat hij opdroogt, werk het losgeweekte vet los met een borstel en spoel na met ruim water. Vang oliehoudend spoelwater op en lever het in; het hoort niet in het oppervlaktewater.</p>
<h2>4. Schroef en onderwaterschip</h2>
<p>Staat de boot op de wal, dan kun je eindelijk goed bij de schroef. Kalk, algen en zeepokken op de bladen kosten snelheid en brandstof, dus dit is het moment om ze te verwijderen. Haal eerst olie- en vetresten weg. Breng dan de <a href="/producten/propeller-cleaner/">Propeller cleaner</a> ruim aan op de bladen en de as, laat hem vijf tot tien minuten inwerken en borstel de losgekomen aanslag weg. Spoel de schroef daarna grondig af met zoet water. Het middel is geschikt voor schroeven van RVS, brons en aluminium.</p>
<p>Loop meteen de rest na: zitten er beschadigingen in de schroefbladen, heeft de as speling en hoeveel is er nog over van de anodes? Een anode die grotendeels is weggevreten, vervang je voordat de boot weer te water gaat.</p>
<h2>Checklist winterklaar maken</h2>
<ul>
<li>Romp, waterlijn en dek gereinigd en nagespoeld</li>
<li>Interieur schoon, textiel van boord of rechtop gezet</li>
<li>Kastjes, luiken en koelkast open, ventilatie vrij</li>
<li>Koelsysteem beschermd tegen vorst</li>
<li>Olie ververst, brandstoftank gevuld, accu's geladen</li>
<li>Drinkwatersysteem en waterpomp afgetapt</li>
<li>Bilge en motorruimte schoon en droog</li>
<li>Schroef gereinigd, anodes en as gecontroleerd</li>
</ul>
<p>Alles in één keer in huis halen? Bekijk alle <a href="/onderhoud/reinigingsproducten/">reinigingsproducten van BluePure Marine</a>. Twijfel je welk middel bij jouw boot past, bel of app ons dan gerust.</p>`,
  },
  {
    slug: "boegschroef-kiezen",
    title: "Welke boegschroef past bij je boot? Stuwkracht, tunneldiameter en 12 of 24 volt",
    excerpt: "Stuwkracht in kgf, de binnendiameter van de tunnel en de boordspanning bepalen welke boegschroef past. Zo maak je de keuze, met de cijfers van de modellen in onze shop.",
    image: "/uploads/products/quick-btq-110-25-boegschroef-25-kgf-12-v-110-mm-1.webp",
    imageAlt: "Quick BTQ 110-25 boegschroef met elektromotor en propeller",
    tags: ["boegschroef", "manoeuvreren", "elektra", "bootonderdelen"],
    metaTitle: "Boegschroef kiezen: kgf, tunnel en volt | BluePure Marine",
    metaDescription: "Welke boegschroef past bij je boot? Lees hoe je kiest op stuwkracht (kgf), tunneldiameter en 12 of 24 volt, met de cijfers van Quick en andere modellen.",
    publishedAt: "2026-11-07T08:00:00.000Z",
    content: `<p>Met een boegschroef duw je de boeg opzij zonder vaart te maken. Dat scheelt stress bij het aanmeren met zijwind, in een krappe box of in een sluis. Maar welke heb je nodig? Drie dingen bepalen de keuze: de stuwkracht, de tunneldiameter en de boordspanning. In dit artikel lopen we ze één voor één langs, met de cijfers van de <a href="/bootonderdelen/boegschroeven/">boegschroeven in onze shop</a>.</p>
<h2>Stuwkracht: hoeveel kgf heb je nodig?</h2>
<p>De kracht van een boegschroef wordt opgegeven in kgf: kilogramkracht. Een boegschroef van 30 kgf duwt even hard tegen de boeg als een gewicht van 30 kilo aan een lijn zou trekken. Hoe meer kgf, hoe makkelijker je de boeg tegen de wind in krijgt.</p>
<p>Fabrikanten koppelen de stuwkracht aan de bootlengte. Dat is een goed startpunt:</p>
<table>
<thead><tr><th>Model</th><th>Stuwkracht</th><th>Tunnel (binnendiameter)</th><th>Motor</th><th>Bootlengte volgens de specificaties</th></tr></thead>
<tbody>
<tr><td>Quick BTQ 110-25</td><td>25 kgf</td><td>110 mm</td><td>1,3 kW, 12 V</td><td>circa 5 tot 7 m</td></tr>
<tr><td>Quick BTQ 125-30</td><td>30 kgf</td><td>125 mm</td><td>1,5 kW, 12 V</td><td>niet opgegeven</td></tr>
<tr><td>Bow Thruster 35 kgf</td><td>35 kgf</td><td>125 mm</td><td>1,5 kW, 12 V</td><td>circa 6 tot 10 m</td></tr>
<tr><td>Bow Thruster 55 kgf</td><td>55 kgf</td><td>150 mm</td><td>3 kW, 12 V</td><td>circa 8 tot 12 m</td></tr>
<tr><td>Bow Thruster 65 kgf</td><td>65 kgf</td><td>185 mm</td><td>3 kW, 12 V</td><td>circa 8 tot 12,5 m</td></tr>
</tbody>
</table>
<p>De lengte zegt niet alles. Wat de boegschroef moet wegduwen, is vooral de wind op de boot. Kijk daarom ook naar:</p>
<ul>
<li><strong>Windvang.</strong> Een motorjacht met een hoge opbouw of een kuiptent vangt veel meer wind dan een lage sloep van dezelfde lengte.</li>
<li><strong>Gewicht en onderwaterschip.</strong> Een zware boot met een lange kiel reageert trager dan een lichte, vlakke romp.</li>
<li><strong>Je ligplaats.</strong> Lig je dwars op de heersende wind of vaar je vaak in stromend water, kies dan ruim.</li>
</ul>
<p>Zit je met je boot op de grens van twee modellen, dan is de sterkere meestal de betere keuze. Een boegschroef die te licht is, merk je juist op het moment dat je hem het hardst nodig hebt.</p>
<h2>Tunneldiameter: wat past er in je boot?</h2>
<p>Een tunnelboegschroef zit in een buis dwars door de boeg. Elk model is gemaakt voor één binnendiameter: 110, 125, 150 of 185 mm bij de modellen hierboven. Dat maakt de keuze soms heel eenvoudig.</p>
<h3>Er zit al een tunnel in</h3>
<p>Meet de binnendiameter van de bestaande tunnel. Die bepaalt welke boegschroef erin past. Is alleen de motor defect, dan hoeft niet alles eruit: voor de Vetus BOW95 en BOW125 in 12 volt bestaat bijvoorbeeld een losse vervangende elektromotor met solenoïde, de Vetus SET0159.</p>
<h3>Er moet een nieuwe tunnel in</h3>
<p>Dan bepaalt de vorm van de boeg wat mogelijk is. Als vuistregel plaats je de tunnel zo ver mogelijk naar voren en zo diep mogelijk onder de waterlijn: ver naar voren voor de hefboom, diep genoeg zodat de schroef geen lucht aanzuigt. Fabrikanten geven in de inbouwhandleiding op hoe diep de tunnel minimaal onder de waterlijn moet liggen, vaak ongeveer één tunneldiameter. In een smalle, ondiepe boeg past dus eerder een tunnel van 110 of 125 mm dan één van 185 mm. Het inlamineren of inlassen van een tunnel is werk voor de werf.</p>
<h2>12 of 24 volt?</h2>
<p>Een boegschroef vraagt kort veel vermogen. Vermogen is spanning maal stroom, dus bij een lage spanning hoort een hoge stroom. De 55 kgf-boegschroef van 3 kW trekt volgens de specificaties 350 ampère bij 12 volt. Dat stelt eisen aan je installatie:</p>
<ul>
<li>dikke accukabels die zo kort mogelijk zijn, om spanningsverlies te beperken;</li>
<li>een accu met voldoende capaciteit, bij voorkeur dicht bij de boegschroef;</li>
<li>een hoofdzekering van het juiste type. Quick schrijft bij de BTQ 110-25 een zekering van 130 A voor en bij de BTQ 125-30 een van 225 A;</li>
<li>een hoofdschakelaar waarmee je de boegschroef spanningsloos maakt.</li>
</ul>
<p>Bij 24 volt is voor hetzelfde vermogen de helft van de stroom nodig. Daarom werken grotere schepen meestal op 24 volt. De boegschroeven in onze shop zijn 12 volt-uitvoeringen. Heeft je boot een 12 volt-boordnet, dan sluit je ze daarop aan. Vaar je op 24 volt, neem dan even contact op, dan kijken we mee naar een passende oplossing.</p>
<p>Houd ook rekening met de gebruiksduur. Een elektrische boegschroef is gemaakt voor korte stoten. De maximale aaneengesloten gebruiksduur van de modellen hierboven is, waar opgegeven, vier tot vijf minuten.</p>
<h2>Bediening: paneel of joystick</h2>
<p>Bij de boegschroef hoort een bedieningspaneel bij de stuurstand. Het <a href="/producten/side-power-8960g-joystick-bedieningspaneel-voor-boegschroef-12-24-v/">Side-Power 8960G joystickpaneel</a> werkt op 12 en 24 volt en schakelt zichzelf na gebruik automatisch uit. Heb je een Vetus BOW PRO-installatie met boeg- én hekschroef, dan bedien je beide proportioneel met één joystick via het Vetus DBPPJA-paneel. Alle panelen vind je bij de <a href="/bootonderdelen/motorbedieningen/">motorbedieningen</a>.</p>
<h2>Samengevat: zo kies je</h2>
<ol>
<li>Meet de lengte van je boot en schat de windvang in.</li>
<li>Kies de stuwkracht die daarbij past, en neem bij twijfel de sterkere.</li>
<li>Controleer de tunneldiameter: wat zit er al in, of wat past er in de boeg?</li>
<li>Controleer de boordspanning, de accucapaciteit en de kabeldikte.</li>
<li>Kies een bedieningspaneel dat bij het merk en type boegschroef hoort.</li>
</ol>
<p>Voor een kleine sloep of sportboot van vijf tot zeven meter is de <a href="/producten/quick-btq-110-25-boegschroef-25-kgf-12-v-110-mm/">Quick BTQ 110-25</a> een logisch startpunt. Kom je er niet uit? Stuur ons het merk en type van je boot, of een foto van de bestaande tunnel, en we zoeken met je mee.</p>`,
  },
  {
    slug: "boot-schoonmaken-stappenplan",
    title: "Boot schoonmaken: stappenplan voor romp, dek, interieur en schroef",
    excerpt: "Van boven naar beneden en van buiten naar binnen: met dit stappenplan maak je je boot in een vaste volgorde schoon, met voor elk onderdeel het juiste middel.",
    image: "/uploads/home/hero-producten.webp",
    imageAlt: "De reinigingslijn van BluePure Marine: reinigers voor exterieur, interieur en schroef",
    tags: ["reinigen", "romp", "interieur", "schroef"],
    metaTitle: "Boot schoonmaken: compleet stappenplan | BluePure Marine",
    metaDescription: "Boot schoonmaken in een vaste volgorde: romp en dek, ramen, interieur, motorruimte en schroef. Met inwerktijden en tips per reiniger van BluePure Marine.",
    publishedAt: "2026-11-10T08:00:00.000Z",
    content: `<p>Een boot schoonmaken gaat het snelst als je een vaste volgorde aanhoudt: van boven naar beneden en van buiten naar binnen. Zo spoel je geen vuil over delen die al klaar zijn. In dit stappenplan lopen we de hele boot langs, van dek tot schroef, met per onderdeel het middel uit de BluePure-lijn dat ervoor gemaakt is.</p>
<h2>Voordat je begint</h2>
<p>Een paar regels gelden voor elke reiniger:</p>
<ul>
<li>Test het middel eerst op een onopvallende plek.</li>
<li>Werk niet in direct zonlicht en niet op hete oppervlakken.</li>
<li>Laat een reiniger tijdens het inwerken nooit opdrogen.</li>
<li>Vermijd onnodig contact met huid en ogen.</li>
</ul>
<p>Leg klaar wat je nodig hebt: een steelborstel voor de grote vlakken, een zachte handborstel voor het interieur, microvezeldoeken, een droogdoek, een emmer en een waterslang. Kies een bewolkte dag of begin vroeg, zodat romp en dek nog koel zijn.</p>
<h2>Stap 1: dek en opbouw</h2>
<p>Begin bovenaan. Spoel dek en opbouw eerst af met water om los zand en zout te verwijderen; dan kras je minder bij het borstelen. Breng daarna de <a href="/producten/exterior-cleaner/">Exterior cleaner</a> aan: puur bij zware vervuiling, verdund bij lichte. Laat hem ongeveer een minuut inwerken, borstel het oppervlak en spoel na met ruim water.</p>
<p>Je kunt op twee manieren werken. Bij de emmermethode meng je de reiniger met water en breng je hem aan met borstel of spons. Dat werkt prettig op grote vlakken zoals het dek. Bij de spraymethode spray je het middel direct op het oppervlak; handig voor plekken met hardnekkig vuil. Besteed extra aandacht aan antislipprofielen: daar zet vuil zich vast in het reliëf, dus borstel in meerdere richtingen.</p>
<h2>Stap 2: romp en waterlijn</h2>
<p>Op de romp zitten vooral zwarte strepen, zoutresten en bij de waterlijn een rand van algen en kalk. De aanpak is dezelfde als op het dek: aanbrengen, kort laten inwerken, borstelen en afspoelen. Werk per vlak van een paar vierkante meter en van boven naar beneden. De Exterior cleaner is geschikt voor gelcoat, polyester, metaal en gelakte oppervlakken, dus ook het RVS-beslag kun je meenemen.</p>
<p>Droog de romp na met een dikke microvezel droogdoek. Dat voorkomt kalkvlekken van opgedroogd spoelwater. Wil je daarna een wax of coating aanbrengen, dan is dit het moment: op een schoon oppervlak hecht die beter. Alles voor de buitenkant staat bij elkaar onder <a href="/onderhoud/exterieur/">exterieur</a>.</p>
<h2>Stap 3: ramen en glas</h2>
<p>Ramen doe je na romp en dek, anders spat er weer vuil water op. De Glass cleaner verwijdert vet, vingerafdrukken en vuil en droogt snel op. Spray, neem af met een schone microvezeldoek en wrijf na met een droge doek voor een streeploos resultaat. Hetzelfde middel gebruik je binnen voor spiegels en glazen delen van het interieur.</p>
<h2>Stap 4: cockpit en interieur</h2>
<p>Binnen werk je met minder water en zachtere hulpmiddelen. De <a href="/producten/interior-cleaner/">Interior cleaner</a> is gemaakt voor kunststof, vinyl, plexiglas, gelakt hout en metaal:</p>
<ol>
<li>Spray de reiniger op een schone microvezeldoek of direct op het oppervlak.</li>
<li>Veeg het oppervlak met lichte druk schoon.</li>
<li>Wrijf na met de droge kant van de doek.</li>
</ol>
<p>Zit het vuil in een structuur of naad, werk het dan eerst los met een zachte handborstel en neem het daarna af. Op displays en instrumenten spray je niet rechtstreeks, maar via de doek.</p>
<h3>Schimmel en weerplekken</h3>
<p>Zwarte puntjes op bekleding, plafond of zeildoek behandel je apart met de Mold remover. Test eerst op kleurechtheid, spray het middel op de vlek en laat het vijf tot tien minuten inwerken. Werk het vuil los met een zachte borstel of spons, neem het oppervlak af met een schone, vochtige doek en laat het goed drogen met de luiken open.</p>
<h3>Kombuis en sanitair</h3>
<p>Voor het aanrecht, het toilet en de wastafel is er Desinfectie. Spray het op het oppervlak of op een doek, neem af en laat het aan de lucht drogen.</p>
<h2>Stap 5: motorruimte en bilge</h2>
<p>Olie, vet en brandstofresten vragen om een ontvetter. Breng de Oil remover onverdund aan en laat hem drie tot vijf minuten inwerken, zonder dat hij opdroogt. Werk het losgeweekte vet los met een borstel, vooral op moeilijk bereikbare plekken, en spoel na met ruim water. Vang oliehoudend water op en lever het in bij de haven of de milieustraat.</p>
<h2>Stap 6: de schroef</h2>
<p>De schroef doe je als de boot op de wal staat. Verwijder eerst olie- en vetresten, zodat de reiniger direct op de aanslag werkt. Breng de <a href="/producten/propeller-cleaner/">Propeller cleaner</a> ruim en gelijkmatig aan op de bladen en de as, met een kwast of sprayer. Laat hem vijf tot tien minuten inwerken; vaak zie je een bruisende reactie waarbij kalk en algen loskomen. Borstel zware aangroei en schelpresten weg met een stijve borstel en spoel de schroef grondig af met zoet water. Het middel is een zure reiniger: draag handschoenen en een veiligheidsbril.</p>
<h2>Opruimen en bewaren</h2>
<p>Spoel borstels uit en was de microvezeldoeken in de wasmachine. Bewaar de reinigers goed afgesloten op een koele, droge en vorstvrije plek, uit de zon en buiten bereik van kinderen. Gebruik je veel, dan zijn de meeste reinigers er ook in een grootverpakking van 5 liter; die vind je met de voordeelsets bij <a href="/pakketten/">pakketten en deals</a>.</p>
<h2>De volgorde in het kort</h2>
<ol>
<li>Dek en opbouw</li>
<li>Romp en waterlijn</li>
<li>Ramen en glas</li>
<li>Cockpit en interieur</li>
<li>Motorruimte en bilge</li>
<li>Schroef</li>
</ol>
<p>Heb je een vraag over een middel of een materiaal aan boord waar je over twijfelt? Bel, app of mail ons, dan denken we met je mee.</p>`,
  },
];
