# BluePure Marine — webshop + CMS

## Belangrijk voor de Replit Agent

Dit is een **kant-en-klare Next.js 15-app (App Router) met Prisma**. Hij draait zoals hij is.

- **Herstructureer het project niet.** Maak geen pnpm-workspace, geen aparte API-server, geen `artifacts/`-map en
  geen proxy. Er is geen `/api/healthz`; de health check gaat naar `/` en krijgt direct 200.
- Gebruik de bestaande `.replit`: build `npm ci && npm run build:replit`, run `npm start`, poort 3800 → 80.
- Database: PostgreSQL via de secret `DATABASE_URL`. `scripts/prisma.mjs` kiest automatisch het PostgreSQL-schema
  zodra `DATABASE_URL` met `postgres://` of `postgresql://` begint. Wijzig `prisma/schema.prisma` niet naar postgresql
  en voeg geen eigen migraties toe; het schema wordt met `prisma db push` bijgewerkt.
- `npm run build:replit` vult een **lege** database met de content uit `content/*.json` (producten, categorieën,
  pagina's, blogs). Draai nooit `npm run db:seed` of `npm run setup` op productie: die maken de content eerst leeg,
  inclusief bestellingen en klanten.
- Kies bij het publiceren **Autoscale** of **Reserved VM** (geen Static): redirects, 404-statussen, de winkelwagen,
  het afrekenen en de Mollie-webhook hebben een server nodig.

## Secrets

| Naam | Waarde |
|---|---|
| `DATABASE_URL` | PostgreSQL-verbinding (Replit-database) |
| `AUTH_SECRET` | Willekeurige tekst van minimaal 32 tekens (sessies van beheer en klanten, versleuteling van API-sleutels). Na het instellen niet meer wijzigen: opgeslagen sleutels van connecties zijn er mee versleuteld. |
| `SITE_URL` | `https://www.bluepuremarine.com` (productiedomein, zonder slash; gebruikt voor canonicals, sitemap, e-mails en de Mollie-redirect/webhook) |

## Eerste beheerder aanmaken

**Via een eenmalige link (ook op productie, zonder Shell):**

1. Voeg de secret `SETUP_TOKEN` toe met een willekeurige waarde van minimaal 24 tekens. Zet hem bij de secrets van
   de deployment (productie) en eventueel ook bij die van de workspace (development); dat zijn aparte databases.
2. Publiceer opnieuw, zodat de secret actief is.
3. Open `https://<domein>/admin/setup/?token=<waarde van SETUP_TOKEN>`, vul e-mailadres, naam en wachtwoord in.
   Je bent daarna ingelogd als superadmin. Bestaat het e-mailadres al, dan krijgt dat account het nieuwe wachtwoord
   en de rol superadmin.
4. De link werkt daarna nooit meer (ook niet met dezelfde secret). Verwijder de secret `SETUP_TOKEN` weer.

Zonder `SETUP_TOKEN`, met een fout token of na gebruik geeft de pagina een 404. Wachtwoord kwijt: zet een nieuwe
waarde in `SETUP_TOKEN` en gebruik de link opnieuw.

**Of in de Shell:** `node scripts/create-admin.mjs naam@domein.nl "Volledige naam"` en typ het wachtwoord in (rol superadmin;
met `--role=admin` of `--role=user` een andere rol). Inloggen op `/admin/`.

Rollen: **superadmin** (alles), **admin** (alles, inclusief Connecties), **user** (alles zien, aanpassen en
verwijderen, behalve Connecties).

## Na de eerste deploy instellen in /admin/

1. **Connecties → Betalingen**: Mollie-sleutels invullen, testen, en "Testbetalingen simuleren" UIT zetten.
   Webhook: `https://www.bluepuremarine.com/api/public/mollie/webhook` (wordt automatisch met elke betaling meegegeven).
2. **Connecties → E-mail**: SparkPost-sleutel en afzender (bestelbevestigingen, verzendmails, formuliermeldingen).
3. **Connecties → Google**: Tag Manager / GA4 / Search Console en eventueel Google Reviews (Places API).
4. **Instellingen → Webshop**: verzendkosten, drempel gratis verzending, levertijdtekst.
5. **Producten**: echte voorraad invullen (de import zette beschikbare producten op een standaardvoorraad).

## Structuur

- `src/app/(site)/` — publieke webshop: home, categorieën en CMS-pagina's (`[...slug]`), `/producten/<slug>/`,
  `/merken/`, `/blog/`, `/zoeken/`, `/winkelwagen/`, `/afrekenen/`, `/bestelling/`, `/account/`
- `src/app/admin/` — beheer; `src/app/api/public/mollie/webhook` — betaalstatus van Mollie
- `src/middleware.ts` — 301's (slash, https + www, redirects uit het beheer incl. de oude Shopify-URL's), afscherming
  van `/admin/`, `X-Robots-Tag: noindex` op elk adres dat niet het productiedomein is (dus ook `*.replit.app`)
- `prisma/schema.prisma` — datamodel (SQLite-notatie; PostgreSQL wordt automatisch afgeleid)
- `content/` — gescrapete content, `public/uploads/` — afbeeldingen

## Let op bij Autoscale

- Afbeeldingen die via het beheer worden geüpload komen in `public/uploads/user/` op het bestandssysteem van de
  container. Op Autoscale is dat niet blijvend: na een herstart of nieuwe deploy zijn ze weg. Gebruik een Reserved VM
  of koppel object storage als er veel via het beheer geüpload wordt. De gescrapete productfoto's staan in de repo
  en blijven altijd bestaan.
- Na de deploy komt nieuwe content uit het beheer direct online: pagina's worden op aanvraag gerenderd en opnieuw
  gecachet zodra er iets wordt opgeslagen. Opnieuw deployen is daarvoor niet nodig.
