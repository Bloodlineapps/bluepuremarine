# BluePure Marine: webshop + CMS (localhost)

Herbouw van www.bluepuremarine.com (was Shopify) als eigen webshop in de stijl van nauticgear.nl: alle 84 producten,
19 collecties, pagina's, beleidsteksten en reviews overgenomen, met winkelwagen, afrekenen (Mollie), klantaccounts en
een compleet beheer onder `/admin/`. Lokaal gebouwd; klaar om via GitHub naar Replit te zetten.

## Starten

```bash
npm install
npm run setup        # database aanmaken + vullen uit content/*.json
npm run dev          # http://localhost:3800
```

Accounts voor `/admin/` (superadmin, admin, user) en een testklant staan in `.env` en worden door `npm run db:seed`
aangemaakt. `.env` staat niet in git; `.env.example` laat zien welke variabelen nodig zijn. Maak in productie
accounts aan met `node scripts/create-admin.mjs naam@domein.nl "Naam" [--role=user|admin|superadmin]`.

| Script | Wat het doet |
|---|---|
| `npm run scrape:parse` | Zet de ruwe scrape (`scripts/raw/`, niet in git) om naar `content/*.json` |
| `npm run images` | Downloadt productfoto's, sfeerbeelden en merklogo's als WebP naar `public/uploads/` en `public/brands/` |
| `npm run db:seed` | Vult de database opnieuw uit `content/` (klanten, bestellingen en logboeken blijven staan) |
| `npm run build` | Productie-build |
| `npm run build:check` | Productie-build in `.next-prod` (dev-server blijft draaien) + SEO-controle (`scripts/seo-check.mjs`, faalt bij fouten, rapport in `seo-report.json`) |
| `npm run seo:check` | Alleen de SEO-controle op de bestaande build (`SEO_BASE=http://…` controleert een draaiende server) |
| `npm run build:replit` | Build voor Replit/Linux: schema bijwerken, lege database vullen, build |
| `npm run db:export` | Exporteert de lokale database als SQL voor PostgreSQL (`export/`) |
| `npm start` | Productieserver op `0.0.0.0:$PORT` (standaard 3800) |

Stack: Next.js 15 (App Router) · React 19 · Tailwind 4 · Prisma (SQLite lokaal, PostgreSQL in productie via
`scripts/prisma.mjs`) · eigen beheer en klantaccounts met JWT-sessies (jose) en bcrypt.

## URL-structuur (maximaal twee niveaus)

| Wat | URL |
|---|---|
| Hoofdcategorie | `/onderhoud/`, `/bootonderdelen/`, `/navigatie-elektronica/`, `/watersport/`, `/pakketten/`, `/bestsellers/` |
| Subcategorie | `/onderhoud/reinigingsproducten/`, `/bootonderdelen/boegschroeven/`, `/watersport/accessoires/` … |
| Product | `/producten/<slug>/` |
| Merk | `/merken/` en `/merken/<slug>/` |
| Blog | `/blog/` en `/blog/<onderwerp>/` |
| Pagina's | `/contact/`, `/klantenservice/`, `/veelgestelde-vragen/`, `/verzending/`, `/retourbeleid/`, `/over-ons/`, `/privacy/`, `/cookies/`, `/algemene-voorwaarden/` … |
| Winkel | `/winkelwagen/`, `/afrekenen/`, `/bestelling/`, `/account/…`, `/zoeken/` (allemaal noindex) |

Paginering met `?pagina=2`. Alle oude Shopify-URL's (`/collections/…`, `/products/…`, `/pages/…`, `/policies/…`)
krijgen een 301 naar de nieuwe URL (tabel Redirect, te beheren in `/admin/redirects/`).

## Rollen in het beheer

| Rol | Mag |
|---|---|
| superadmin | Alles, inclusief het beheren van andere superadmins |
| admin | Alles, inclusief Connecties (Google, Mollie, SparkPost, AI) |
| user | Alles zien, aanpassen en verwijderen, behalve Connecties |

Niemand kan een rol toekennen die hoger is dan de eigen rol.

## Betalen

Betalingen lopen via Mollie (Connecties → Betalingen): de betaling wordt op de server aangemaakt, de webhook
`/api/public/mollie/webhook` haalt de status altijd opnieuw bij Mollie op en werkt de bestelling, de voorraad en de
e-mails bij. Lokaal staat "Testbetalingen simuleren" aan: afrekenen eindigt dan op `/afrekenen/testbetaling/`, waar je
zelf kiest of de betaling slaagt, mislukt of wordt geannuleerd. Zet dat uit zodra de echte Mollie-sleutels erin staan.

## Naar GitHub en Replit

```bash
git add -A
git commit -m "BluePure Marine webshop"
git remote add origin https://github.com/<account>/bluepuremarine.git
git push -u origin main
```

Importeer de repo daarna in Replit. `.replit` en `replit.md` regelen de rest: secrets `DATABASE_URL` (PostgreSQL),
`AUTH_SECRET` en `SITE_URL`, build `npm ci && npm run build:replit`, start `npm start`. Zie `replit.md` voor de
stappen na de eerste deploy (Mollie, SparkPost, verzendkosten, voorraad).

## Nog door de klant te beslissen of in te vullen

- Echte voorraad per product (de import zette beschikbare producten op een standaardaantal).
- Privacyverklaring, cookieverklaring en de consumentenartikelen in de algemene voorwaarden zijn concepten en
  moeten juridisch gecontroleerd worden.
- Tegenstrijdigheden van de oude site: levertijd ("binnen 5 werkdagen" tegenover "voor 16:00 besteld, vandaag
  verzonden") en prijzen incl./excl. btw in de voorwaarden.
- Google-reviewscore: de header toont nu het gemiddelde van de eigen, goedgekeurde reviews. Met een Place ID en
  API-sleutel (Connecties → Google → Google Reviews) of handmatig (Instellingen → Reviews) komt daar de Google-score.
