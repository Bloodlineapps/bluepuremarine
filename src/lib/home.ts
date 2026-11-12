import "server-only";
import { cache } from "react";
import { db } from "./db";
import { parse } from "./json";

// Inhoud van de homepage die in het beheer aan te passen is (/admin/instellingen/homepage/): de drie actieblokken
// bovenaan (één groot blok links, twee kleinere rechts boven elkaar) en de teksten van de vaste secties.

export type HeroTheme = "navy" | "blue" | "aqua" | "coral";

export type HeroBlock = {
  /** klein label boven de kop */
  eyebrow: string;
  /** kop in hoofdletters; een regelafbreking met \n */
  title: string;
  text: string;
  cta: string;
  href: string;
  theme: HeroTheme;
  /** eigen afbeelding (/uploads/…): vult het blok als achtergrond, met een verloop in de themakleur eroverheen; leeg = alleen het kleurvlak */
  image: string;
  imageAlt: string;
  /** slug van een product: toont de productfoto in een witte ronde schijf en de "vanaf"-prijs in een prijsblok */
  productSlug: string;
  /** tekst in het prijsblok, bv. "Al vanaf" (leeg = geen prijsblok) */
  priceLabel: string;
};

export type HomeSettings = {
  /** [groot links, rechts boven, rechts onder] */
  hero: [HeroBlock, HeroBlock, HeroBlock];
  /** H1 van de homepage (staat onder de actieblokken) */
  heading: string;
  intro: string;
  /** blok "Over BluePure Marine" */
  aboutTitle: string;
  aboutText: string;
  /** SEO-tekst onderaan (HTML) */
  seoText: string;
};

export const DEFAULT_HOME: HomeSettings = {
  hero: [
    { eyebrow: "BluePure reinigingslijn", title: "Alles voor je boot.\nGoed geregeld.", text: "Reinigers voor romp, dek, kajuit en schroef. Getest in zout water, zon en dagelijks gebruik.", cta: "Shop onderhoud", href: "/onderhoud/", theme: "navy", image: "/uploads/home/hero-producten.webp", imageAlt: "De reinigingslijn van BluePure Marine: flessen cleaner voor exterieur, interieur en schroef", productSlug: "exterior-cleaner", priceLabel: "Al vanaf" },
    { eyebrow: "Bootonderdelen", title: "Boegschroeven", text: "Van Quick en Vetus. Manoeuvreer zonder stress de box in.", cta: "Bekijk boegschroeven", href: "/bootonderdelen/boegschroeven/", theme: "blue", image: "", imageAlt: "", productSlug: "quick-btq-110-25-boegschroef-25-kgf-12-v-110-mm", priceLabel: "" },
    { eyebrow: "Pakketten & deals", title: "5 liter deals", text: "Grootverpakkingen voor wie veel poetst.", cta: "Bekijk de deals", href: "/pakketten/5-liter-deals/", theme: "coral", image: "", imageAlt: "", productSlug: "exterior-cleaner-5liter", priceLabel: "Al vanaf" },
  ],
  heading: "Onderhoudsmiddelen en bootonderdelen voor je boot",
  intro: "Onderhoudsmiddelen en bootonderdelen van merken die je kunt vertrouwen. Snel verzonden, met persoonlijk advies.",
  aboutTitle: "Uit de praktijk, voor de praktijk",
  aboutText: "BluePure Marine heeft jarenlange ervaring met het professioneel reinigen en onderhouden van boten en jachten. Die kennis zit in onze eigen reinigingslijn: middelen die getest zijn in zout water, zon en dagelijks gebruik. Naast onze reinigingslijn leveren we onderdelen, elektronica en watersportartikelen, vanuit Waspik en met persoonlijk advies als je twijfelt wat past bij jouw boot.",
  seoText: "",
};

export const getHome = cache(async (): Promise<HomeSettings> => {
  const row = await db.setting.findUnique({ where: { key: "home" } });
  const saved = parse<Partial<HomeSettings>>(row?.value, {});
  const hero = DEFAULT_HOME.hero.map((d, i) => ({ ...d, ...(saved.hero?.[i] ?? {}) })) as HomeSettings["hero"];
  return { ...DEFAULT_HOME, ...saved, hero };
});
