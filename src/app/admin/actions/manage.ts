"use server";
import fs from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/components/admin/fields";
import { testAi } from "@/lib/ai";
import { audit } from "@/lib/admin/audit";
import { bool, isRedirect, normalizePath, num, refresh, str } from "@/lib/admin/common";
import { ROLE_LABELS } from "@/lib/admin/labels";
import { mediaUsage } from "@/lib/admin/media-usage";
import { assignError, deleteError, manageError, roleChangeError } from "@/lib/admin/roles";
import { cleanHtml } from "@/lib/admin/sanitize";
import { assertRole } from "@/lib/auth";
import { decrypt, encrypt, maskKey } from "@/lib/crypto";
import { db } from "@/lib/db";
import { getHome, type HeroBlock, type HeroTheme, type HomeSettings } from "@/lib/home";
import { sendMail, testSparkpost } from "@/lib/mail";
import { toCents } from "@/lib/money";
import { BRAND, getConnections, getReviewSettings, getShop, getSite, saveSetting, type Connections, type ReviewSettings, type ShopSettings, type SiteSettings } from "@/lib/settings";

// Server actions voor media, redirects, gebruikers, instellingen en connecties. Rechten worden bij elke actie
// op de server gecontroleerd: alles is voor elke ingelogde gebruiker, behalve connecties (minimaal Beheerder).
// Sleutels worden versleuteld opgeslagen en nooit volledig teruggegeven.

const fail = (error: string): ActionResult => ({ error });
const nowTest = (ok: boolean, message: string) => ({ ok, at: new Date().toISOString(), message: message.slice(0, 300) });
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const GTM_ID = /^GTM-[A-Z0-9]{4,10}$/;
const GA4_ID = /^G-[A-Z0-9]{6,12}$/;

// ---------- media ----------
export async function updateMediaAlt(id: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const m = await db.media.update({ where: { id }, data: { alt: str(form, "alt").slice(0, 250), folder: str(form, "folder").slice(0, 60) } });
    await audit(user, "gewijzigd", "Media", id, `Alt-tekst en map van ${m.path} bijgewerkt`);
    return { ok: true, message: "Opgeslagen." };
  } catch {
    return fail("Opslaan mislukt");
  }
}

export async function deleteMedia(id: string) {
  const user = await assertRole("user");
  const m = await db.media.findUniqueOrThrow({ where: { id } });
  if ((await mediaUsage(m.path)).length) redirect(`/admin/media/?id=${id}&inGebruik=1`);
  await db.media.delete({ where: { id } });
  if (m.path.startsWith("/uploads/")) await fs.unlink(path.join(process.cwd(), "public", m.path)).catch(() => {});
  await audit(user, "verwijderd", "Media", id, `${m.path} verwijderd`);
  redirect("/admin/media/?verwijderd=1");
}

// ---------- redirects ----------
export async function saveRedirect(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const from = normalizePath(str(form, "from"));
    const toRaw = str(form, "to");
    const to = /^https?:\/\//.test(toRaw) ? toRaw : normalizePath(toRaw);
    if (!from || !to) return fail("Vul een geldig oud en nieuw pad in (met slash aan het eind).");
    if (from === to) return fail("Oud en nieuw pad zijn gelijk.");
    const status = num(form, "status") === 302 ? 302 : 301;
    await db.redirect.upsert({ where: { from }, create: { from, to, status }, update: { to, status } });
    await audit(user, "aangemaakt", "Redirect", null, `${from} → ${to} (${status})`);
    revalidatePath("/admin/redirects/");
    return { ok: true, message: `Redirect ${from} → ${to} opgeslagen.` };
  } catch {
    return fail("Opslaan mislukt");
  }
}

export async function deleteRedirect(id: string) {
  const user = await assertRole("user");
  const r = await db.redirect.delete({ where: { id } });
  await audit(user, "verwijderd", "Redirect", id, `${r.from} → ${r.to} verwijderd`);
  revalidatePath("/admin/redirects/");
}

/** Bulk: redirects verwijderen. */
export async function bulkRedirects(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const ids = form.getAll("ids").map(String);
    if (!ids.length) return fail("Selecteer eerst redirects.");
    if (str(form, "bulk") !== "delete") return fail("Kies een actie.");
    const r = await db.redirect.deleteMany({ where: { id: { in: ids } } });
    await audit(user, "verwijderd", "Redirect", null, `${r.count} redirects verwijderd`);
    revalidatePath("/admin/redirects/");
    return { ok: true, message: `${r.count} gelukt${ids.length - r.count ? `, ${ids.length - r.count} mislukt` : ""}.` };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Mislukt");
  }
}

/** 404-log leegmaken (bijvoorbeeld nadat de redirects zijn aangemaakt). */
export async function clearNotFound() {
  const user = await assertRole("user");
  const r = await db.notFoundHit.deleteMany({});
  await audit(user, "verwijderd", "Redirect", null, `404-log geleegd (${r.count} regels)`);
  revalidatePath("/admin/redirects/");
}

// ---------- gebruikers ----------
const userSchema = z.object({ name: z.string().trim().min(2, "Vul een naam in"), email: z.string().trim().toLowerCase().email("Ongeldig e-mailadres"), roleId: z.string().min(1, "Kies een rol"), password: z.string() });

export async function saveUser(id: string | null, _: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const me = await assertRole("user");
    const parsed = userSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const d = parsed.data;
    if (!id && d.password.length < 12) return fail("Kies een wachtwoord van minimaal 12 tekens.");
    if (d.password && d.password.length < 12) return fail("Een nieuw wachtwoord moet minimaal 12 tekens hebben.");
    const role = await db.role.findUnique({ where: { id: d.roleId } });
    if (!role) return fail("Onbekende rol.");
    const data = { name: d.name, email: d.email, roleId: role.id, ...(d.password ? { passwordHash: await bcrypt.hash(d.password, 11) } : {}) };
    if (id) {
      const target = await db.user.findUnique({ where: { id }, include: { role: true } });
      if (!target) return fail("Gebruiker niet gevonden.");
      const err = target.role.key === role.key ? manageError(me, target.role.key) : await roleChangeError(me, target, role.key);
      if (err) return fail(err);
      await db.user.update({ where: { id }, data });
      await audit(me, "gewijzigd", "Gebruiker", id, `Gebruiker ${d.name} bijgewerkt${target.role.key !== role.key ? ` (rol: ${ROLE_LABELS[target.role.key] ?? target.role.key} → ${ROLE_LABELS[role.key] ?? role.key})` : ""}${d.password ? ", nieuw wachtwoord" : ""}`);
    } else {
      const err = assignError(me, role.key);
      if (err) return fail(err);
      const u = await db.user.create({ data: data as typeof data & { passwordHash: string } });
      await audit(me, "aangemaakt", "Gebruiker", u.id, `Gebruiker ${d.name} aangemaakt (${ROLE_LABELS[role.key] ?? role.key})`);
      redirect("/admin/gebruikers/?opgeslagen=1");
    }
    revalidatePath("/admin/gebruikers/");
    return { ok: true, message: "Opgeslagen." };
  } catch (e) {
    if (isRedirect(e)) throw e;
    return fail(e instanceof Error && /Unique/.test(e.message) ? "Er bestaat al een gebruiker met dit e-mailadres." : e instanceof Error ? e.message : "Opslaan mislukt");
  }
}

export async function deleteUser(id: string) {
  const me = await assertRole("user");
  const target = await db.user.findUnique({ where: { id }, include: { role: true } });
  if (!target) redirect("/admin/gebruikers/");
  const err = await deleteError(me, target);
  if (err) redirect(`/admin/gebruikers/?bewerk=${id}&fout=${encodeURIComponent(err)}`);
  await db.user.delete({ where: { id } });
  await audit(me, "verwijderd", "Gebruiker", id, `Gebruiker ${target.name} (${target.email}) verwijderd`);
  redirect("/admin/gebruikers/?verwijderd=1");
}

/** Bulk: rol wijzigen of verwijderen. Elke gebruiker wordt apart gecontroleerd tegen de regels in lib/admin/roles. */
export async function bulkUsers(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const me = await assertRole("user");
    const ids = [...new Set(form.getAll("ids").map(String))];
    const action = str(form, "bulk");
    if (!ids.length) return fail("Selecteer eerst gebruikers.");
    const role = action.startsWith("role:") ? await db.role.findUnique({ where: { key: action.slice(5) } }) : null;
    if (action.startsWith("role:")) {
      if (!role) return fail("Onbekende rol.");
      const err = assignError(me, role.key);
      if (err) return fail(err);
    } else if (action !== "delete") return fail("Kies een actie.");
    let ok = 0;
    let bad = 0;
    let reason = "";
    for (const id of ids) {
      // per gebruiker opnieuw ophalen: het aantal superadmins kan tijdens de bulkactie veranderen
      const target = await db.user.findUnique({ where: { id }, include: { role: true } });
      const err = !target ? "Gebruiker niet gevonden." : role ? (target.role.key === role.key ? manageError(me, target.role.key) : await roleChangeError(me, target, role.key)) : await deleteError(me, target);
      if (err || !target) {
        bad++;
        reason ||= err ?? "";
        continue;
      }
      if (role) await db.user.update({ where: { id }, data: { roleId: role.id } });
      else await db.user.delete({ where: { id } });
      ok++;
    }
    if (ok) await audit(me, role ? "gewijzigd" : "verwijderd", "Gebruiker", null, role ? `Rol van ${ok} gebruikers gewijzigd naar ${ROLE_LABELS[role.key] ?? role.key}` : `${ok} gebruikers verwijderd`);
    return { ok: true, message: `${ok} gelukt${bad ? `, ${bad} mislukt (${reason})` : ""}.` };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Mislukt");
  } finally {
    revalidatePath("/admin/gebruikers/");
  }
}

// ---------- instellingen ----------
const httpsUrl = (form: FormData, k: string) => {
  const v = str(form, k);
  return /^https:\/\//.test(v) ? v : "";
};

export async function saveSiteSettings(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const site = await getSite();
    const email = str(form, "email");
    if (!isEmail(email)) return fail("Ongeldig e-mailadres.");
    const next: SiteSettings = {
      ...site,
      name: str(form, "name") || site.name,
      legalName: str(form, "legalName") || site.legalName,
      tagline: str(form, "tagline"),
      email,
      phone: str(form, "phone"),
      phoneIntl: str(form, "phoneIntl").replace(/[^\d+]/g, ""),
      whatsapp: str(form, "whatsapp").replace(/\D/g, ""),
      whatsappText: String(form.get("whatsappText") ?? "").slice(0, 300),
      street: str(form, "street"),
      postalCode: str(form, "postalCode").toUpperCase(),
      city: str(form, "city"),
      country: (str(form, "country") || "NL").toUpperCase().slice(0, 2),
      kvk: str(form, "kvk").replace(/\D/g, ""),
      vat: str(form, "vat").toUpperCase().replace(/\s/g, ""),
      serviceHours: str(form, "serviceHours"),
      socials: { facebook: httpsUrl(form, "facebook"), instagram: httpsUrl(form, "instagram"), x: httpsUrl(form, "x"), linkedin: httpsUrl(form, "linkedin"), youtube: httpsUrl(form, "youtube") },
    };
    const skipped = (["facebook", "instagram", "x", "linkedin", "youtube"] as const).filter((k) => str(form, k) && !next.socials[k]);
    await saveSetting("site", next);
    await audit(user, "gewijzigd", "Instellingen", "site", "Bedrijfsgegevens bijgewerkt");
    refresh();
    return { ok: true, message: `Opgeslagen. Header, footer, e-mails en structured data gebruiken direct de nieuwe gegevens.${skipped.length ? ` Niet opgeslagen (moet met https:// beginnen): ${skipped.join(", ")}.` : ""}` };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Opslaan mislukt");
  }
}

/** Winkelinstellingen: bedragen worden in euro's ingevuld en in centen opgeslagen. */
export async function saveShopSettings(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const shop = await getShop();
    let rows: { country?: string; label?: string; cost?: string }[];
    try {
      rows = JSON.parse(str(form, "shipping") || "[]");
    } catch {
      return fail("De verzendkosten konden niet gelezen worden.");
    }
    const shipping: ShopSettings["shipping"] = [];
    for (const r of rows) {
      const country = String(r.country ?? "").trim().toUpperCase();
      const label = String(r.label ?? "").trim();
      const cost = toCents(String(r.cost ?? ""));
      if (!country && !label) continue;
      if (!/^[A-Z]{2}$/.test(country)) return fail(`"${country || label}": vul een landcode van twee letters in (bijvoorbeeld NL, BE of DE).`);
      if (!label) return fail(`Vul bij ${country} de naam van het land in.`);
      if (cost === null) return fail(`Vul bij ${label} geldige verzendkosten in (bijvoorbeeld 6,95).`);
      if (shipping.some((s) => s.country === country)) return fail(`${country} staat er twee keer in.`);
      shipping.push({ country, label, cost });
    }
    if (!shipping.length) return fail("Voeg minstens één land toe waar je naar verzendt.");
    const free = str(form, "freeShippingFrom") ? toCents(str(form, "freeShippingFrom")) : 0;
    if (free === null) return fail("Vul bij gratis verzending een geldig bedrag in (bijvoorbeeld 75 of 75,00), of laat het veld leeg.");
    const returnDays = Math.round(num(form, "returnDays") ?? shop.returnDays);
    if (returnDays < 0 || returnDays > 365) return fail("Het aantal retourdagen moet tussen 0 en 365 liggen.");
    const perPage = Math.round(num(form, "perPage") ?? shop.perPage);
    if (perPage < 4 || perPage > 96) return fail("Producten per pagina: kies een aantal tussen 4 en 96.");
    const orderPrefix = str(form, "orderPrefix").toUpperCase();
    if (!/^[A-Z0-9-]{0,10}$/.test(orderPrefix)) return fail("Het voorvoegsel van bestelnummers mag alleen letters, cijfers en een koppelteken bevatten (maximaal 10 tekens).");
    const orderNotifyEmail = str(form, "orderNotifyEmail");
    if (orderNotifyEmail && !isEmail(orderNotifyEmail)) return fail("Het meldadres is geen geldig e-mailadres.");
    const next: ShopSettings = {
      ...shop,
      shipping,
      freeShippingFrom: free,
      deliveryNote: str(form, "deliveryNote"),
      returnDays,
      usps: [str(form, "usp1"), str(form, "usp2"), str(form, "usp3")].filter(Boolean),
      perPage,
      orderPrefix,
      orderNotifyEmail,
      iban: str(form, "iban").toUpperCase().replace(/\s/g, ""),
    };
    await saveSetting("shop", next);
    await audit(user, "gewijzigd", "Instellingen", "shop", "Webshopinstellingen bijgewerkt");
    refresh();
    return { ok: true, message: "Opgeslagen. Winkelwagen, afrekenen en productpagina's gebruiken direct de nieuwe instellingen." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Opslaan mislukt");
  }
}

const THEMES: HeroTheme[] = ["navy", "blue", "aqua", "coral"];

/** Homepage: de drie actieblokken bovenaan en de vaste teksten (Setting-key "home"). */
export async function saveHomeSettings(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const home = await getHome();
    const hero: HeroBlock[] = [];
    for (let i = 0; i < 3; i++) {
      const g = (k: string) => str(form, `hero_${i}_${k}`);
      const nr = i + 1;
      const title = String(form.get(`hero_${i}_title`) ?? "").replace(/\r/g, "").trim();
      if (!title) return fail(`Actieblok ${nr}: vul een titel in.`);
      const href = g("href");
      if (!/^(\/|https:\/\/)/.test(href)) return fail(`Actieblok ${nr}: de link begint met / (bijvoorbeeld /onderhoud/) of met https://.`);
      const productSlug = g("productSlug");
      if (productSlug && !(await db.product.findFirst({ where: { slug: productSlug, deletedAt: null }, select: { id: true } }))) return fail(`Actieblok ${nr}: er bestaat geen product met de slug "${productSlug}".`);
      const image = g("image");
      const imageAlt = g("imageAlt");
      if (image && !imageAlt) return fail(`Actieblok ${nr}: geef de afbeelding een alt-tekst.`);
      const theme = THEMES.includes(g("theme") as HeroTheme) ? (g("theme") as HeroTheme) : home.hero[i].theme;
      hero.push({ eyebrow: g("eyebrow"), title, text: g("text"), cta: g("cta"), href: href.startsWith("/") && !/[?#.]/.test(href) && !href.endsWith("/") ? `${href}/` : href, theme, image, imageAlt, productSlug, priceLabel: g("priceLabel") });
    }
    const heading = str(form, "heading");
    if (!heading) return fail("Vul de kop (H1) van de homepage in.");
    const next: HomeSettings = { hero: hero as HomeSettings["hero"], heading, intro: str(form, "intro"), aboutTitle: str(form, "aboutTitle"), aboutText: str(form, "aboutText"), seoText: cleanHtml(str(form, "seoText")) };
    await saveSetting("home", next);
    await audit(user, "gewijzigd", "Instellingen", "home", "Homepage (actieblokken en teksten) bijgewerkt");
    refresh("/");
    return { ok: true, message: "Opgeslagen. De homepage is direct bijgewerkt." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Opslaan mislukt");
  }
}

/** Reviewscore in de header. Bij bron "site" rekent de site zelf met de goedgekeurde reviews. */
export async function saveReviewSettings(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const cur = await getReviewSettings();
    const rating = num(form, "rating") ?? 0;
    if (rating < 0 || rating > 5) return fail("De score ligt tussen 0 en 5 (bijvoorbeeld 4,8).");
    const count = Math.round(num(form, "count") ?? 0);
    if (count < 0) return fail("Het aantal reviews kan niet negatief zijn.");
    const url = str(form, "url");
    if (url && !/^https:\/\//.test(url)) return fail("De link naar de reviews moet met https:// beginnen.");
    const next: ReviewSettings = { ...cur, enabled: bool(form, "enabled"), source: str(form, "source") === "google" ? "google" : "site", rating: Math.round(rating * 10) / 10, count, url };
    if (next.rating !== cur.rating || next.count !== cur.count) next.updatedAt = new Date().toISOString();
    await saveSetting("reviews", next);
    await audit(user, "gewijzigd", "Instellingen", "reviews", `Reviewscore bijgewerkt (${next.enabled ? "aan" : "uit"}, bron ${next.source})`);
    refresh();
    return { ok: true, message: "Opgeslagen." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Opslaan mislukt");
  }
}

export async function saveSeoSettings(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const raw = str(form, "bingVerification");
    const bingVerification = /content="([^"]+)"/.exec(raw)?.[1] ?? raw;
    if (bingVerification && !/^[A-Za-z0-9_-]{8,80}$/.test(bingVerification)) return fail("Plak de verificatiecode (of de hele meta-tag) uit Bing Webmaster Tools.");
    await saveSetting("seo", { bingVerification });
    await audit(user, "gewijzigd", "Instellingen", "seo", "SEO-instellingen bijgewerkt");
    refresh("/");
    return { ok: true, message: "Opgeslagen." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Opslaan mislukt");
  }
}

// ---------- connecties (minimaal Beheerder) ----------
async function updateConnection<K extends keyof Connections>(key: K, patch: Partial<Connections[K]>) {
  const all = await getConnections();
  const next = { ...all, [key]: { ...all[key], ...patch } };
  await saveSetting("connections", next);
  return next[key];
}

/** Nieuwe sleutel versleutelen; leeg veld = bestaande sleutel houden. */
function keyPatch(form: FormData, field: string, encName: string, hintName: string) {
  const v = str(form, field);
  return v ? { [encName]: encrypt(v), [hintName]: maskKey(v) } : {};
}

export async function saveGoogle(part: "gtm" | "ga4" | "gsc", _: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    // Aan of uit bepaalt alleen de schakelaar op de kaart (toggleConnection). Het formulier neemt de stand uit de
    // database over: een verborgen veld met de stand van het laden van de pagina zette een koppeling die net was
    // uitgezet bij het opslaan ongemerkt weer aan.
    const enabled = (await getConnections())[part].enabled;
    if (part === "gtm") {
      const containerId = str(form, "containerId").toUpperCase();
      if (containerId && !GTM_ID.test(containerId)) return fail("Een container-ID ziet eruit als GTM-XXXXXXX.");
      if (enabled && !containerId) return fail("Vul eerst een container-ID in.");
      await updateConnection("gtm", { enabled, containerId, headCode: str(form, "headCode"), bodyCode: str(form, "bodyCode") });
    } else if (part === "ga4") {
      const measurementId = str(form, "measurementId").toUpperCase();
      if (measurementId && !GA4_ID.test(measurementId)) return fail("Een Measurement-ID ziet eruit als G-XXXXXXXXXX.");
      if (enabled && !measurementId) return fail("Vul eerst een Measurement-ID in.");
      const sa = str(form, "serviceAccount");
      if (sa) {
        try {
          const j = JSON.parse(sa) as { client_email?: string; private_key?: string };
          if (!j.client_email || !j.private_key) throw new Error();
        } catch {
          return fail("Het serviceaccount moet de JSON-sleutel van Google Cloud zijn (met client_email en private_key).");
        }
      }
      await updateConnection("ga4", { enabled, measurementId, propertyId: str(form, "propertyId").replace(/\D/g, ""), ...(sa ? { serviceAccountEnc: encrypt(sa), serviceAccountHint: (JSON.parse(sa) as { client_email: string }).client_email } : {}) });
    } else {
      const raw = str(form, "verification");
      const verification = /content="([^"]+)"/.exec(raw)?.[1] ?? raw;
      if (verification && !/^[A-Za-z0-9_-]{20,80}$/.test(verification)) return fail("Plak de verificatiecode (of de hele meta-tag) uit Search Console.");
      await updateConnection("gsc", { enabled, verification });
    }
    await audit(user, "gewijzigd", "Connectie", part, `Google ${part.toUpperCase()} ${enabled ? "aan" : "uit"} gezet / bijgewerkt`);
    refresh("/");
    return { ok: true, message: "Opgeslagen." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Opslaan mislukt");
  }
}

/** Controleert of de container/ID echt bestaat bij Google (scriptbestand opvragen). */
export async function testGoogle(part: "gtm" | "ga4" | "gsc"): Promise<ActionResult> {
  const user = await assertRole("admin");
  const c = await getConnections();
  let res: { ok: boolean; message: string };
  try {
    if (part === "gtm") {
      if (!c.gtm.containerId) throw new Error("Nog geen container-ID ingesteld.");
      const r = await fetch(`https://www.googletagmanager.com/gtm.js?id=${c.gtm.containerId}`, { signal: AbortSignal.timeout(10_000) });
      if (!r.ok) throw new Error(`Google kent container ${c.gtm.containerId} niet (status ${r.status}). Is de container gepubliceerd?`);
      res = { ok: true, message: `Container ${c.gtm.containerId} gevonden en gepubliceerd.` };
    } else if (part === "ga4") {
      if (!c.ga4.measurementId) throw new Error("Nog geen Measurement-ID ingesteld.");
      const r = await fetch(`https://www.googletagmanager.com/gtag/js?id=${c.ga4.measurementId}`, { signal: AbortSignal.timeout(10_000) });
      if (!r.ok) throw new Error(`Google kent ${c.ga4.measurementId} niet (status ${r.status}).`);
      res = { ok: true, message: `Measurement-ID ${c.ga4.measurementId} gevonden.` };
    } else {
      if (!c.gsc.verification) throw new Error("Nog geen verificatiecode ingesteld.");
      res = { ok: true, message: "De meta-tag google-site-verification staat in de head van elke pagina. Klik in Search Console op Verifiëren en dien /sitemap_index.xml in." };
    }
  } catch (e) {
    res = { ok: false, message: e instanceof Error ? e.message : "Test mislukt" };
  }
  await updateConnection(part, { lastTest: nowTest(res.ok, res.message) } as never);
  await audit(user, "getest", "Connectie", part, res.message);
  return res.ok ? { ok: true, message: res.message } : fail(res.message);
}

/** Google Reviews: Place ID en API-sleutel (Places API) voor de reviewscore in de header. */
export async function saveGoogleReviews(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    const placeId = str(form, "placeId");
    if (placeId && !/^[A-Za-z0-9_-]{10,300}$/.test(placeId)) return fail("Een Place ID bestaat uit letters, cijfers, - en _ (bijvoorbeeld ChIJ…).");
    const c = (await getConnections()).googleReviews;
    const enabled = c.enabled;
    if (enabled && (!placeId || (!str(form, "key") && !c.keyEnc))) return fail("Vul eerst een Place ID en een API-sleutel in.");
    await updateConnection("googleReviews", { enabled, placeId, ...keyPatch(form, "key", "keyEnc", "keyHint") });
    await audit(user, "gewijzigd", "Connectie", "googleReviews", `Google Reviews ${enabled ? "aan" : "uit"} / bijgewerkt${str(form, "key") ? " (nieuwe API-sleutel)" : ""}`);
    return { ok: true, message: "Opgeslagen. Klik op Verbinding testen om de score op te halen." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Opslaan mislukt");
  }
}

/** Haalt score en aantal reviews op via de Places API (New) en zet ze in de reviewinstellingen (bron: Google). */
export async function testGoogleReviews(): Promise<ActionResult> {
  const user = await assertRole("admin");
  const c = (await getConnections()).googleReviews;
  let ok = false;
  let message: string;
  try {
    const key = decrypt(c.keyEnc);
    if (!c.placeId) throw new Error("Er is nog geen Place ID ingesteld.");
    if (!key) throw new Error("Er is nog geen API-sleutel ingesteld (of hij kan niet meer ontsleuteld worden: vul hem opnieuw in).");
    const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(c.placeId)}`, { headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "rating,userRatingCount,googleMapsUri" }, signal: AbortSignal.timeout(10_000), cache: "no-store" });
    const data = (await r.json().catch(() => null)) as { rating?: number; userRatingCount?: number; googleMapsUri?: string; error?: { message?: string; status?: string } } | null;
    if (!r.ok) throw new Error(`Google gaf status ${r.status}${data?.error?.message ? `: ${data.error.message}` : ""}. Controleer de Place ID, de sleutel en of de Places API (New) aan staat in Google Cloud.`);
    if (typeof data?.rating !== "number") throw new Error("Deze plek heeft bij Google (nog) geen reviewscore.");
    const cur = await getReviewSettings();
    const next: ReviewSettings = { ...cur, source: "google", rating: Math.round(data.rating * 10) / 10, count: data.userRatingCount ?? 0, url: data.googleMapsUri || cur.url, updatedAt: new Date().toISOString() };
    await saveSetting("reviews", next);
    ok = true;
    message = `Gelukt: score ${String(next.rating).replace(".", ",")} op basis van ${next.count} Google-reviews. De reviewinstellingen zijn bijgewerkt (bron: Google).`;
    refresh();
  } catch (e) {
    message = e instanceof Error ? e.message : "Test mislukt";
  }
  await updateConnection("googleReviews", { lastTest: nowTest(ok, message) });
  await audit(user, "getest", "Connectie", "googleReviews", message);
  return ok ? { ok, message } : fail(message);
}

export async function saveMollie(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    const test = str(form, "testKey");
    const live = str(form, "liveKey");
    if (test && !/^test_[A-Za-z0-9]{20,}$/.test(test)) return fail("Een test-API-sleutel begint met test_.");
    if (live && !/^live_[A-Za-z0-9]{20,}$/.test(live)) return fail("Een live-API-sleutel begint met live_.");
    const mode = str(form, "mode") === "live" ? "live" : "test";
    const c = (await getConnections()).mollie;
    const enabled = c.enabled;
    const simulate = bool(form, "simulate");
    if (enabled && !(mode === "live" ? live || c.liveKeyEnc : test || c.testKeyEnc)) return fail(`Vul eerst een ${mode}-sleutel in.`);
    await updateConnection("mollie", { enabled, mode, simulate, ...keyPatch(form, "testKey", "testKeyEnc", "testKeyHint"), ...keyPatch(form, "liveKey", "liveKeyEnc", "liveKeyHint") });
    await audit(user, "gewijzigd", "Connectie", "mollie", `Mollie bijgewerkt (${mode}, ${enabled ? "aan" : "uit"}${simulate !== c.simulate ? `, testbetalingen simuleren ${simulate ? "AAN" : "uit"}` : ""}${test || live ? ", nieuwe sleutel" : ""})`);
    refresh();
    return { ok: true, message: simulate ? "Opgeslagen. Let op: testbetalingen simuleren staat aan." : "Opgeslagen." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Opslaan mislukt");
  }
}

export async function testMollie(): Promise<ActionResult> {
  const user = await assertRole("admin");
  const c = (await getConnections()).mollie;
  const key = decrypt(c.mode === "live" ? c.liveKeyEnc : c.testKeyEnc);
  let ok = false;
  let message: string;
  let methods: string[] = c.methods;
  try {
    if (!key) throw new Error(`Er is nog geen ${c.mode}-sleutel ingesteld.`);
    const r = await fetch("https://api.mollie.com/v2/methods", { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10_000) });
    if (r.status === 401) throw new Error("Mollie accepteert deze API-sleutel niet.");
    if (!r.ok) throw new Error(`Mollie gaf status ${r.status}.`);
    const data = (await r.json()) as { _embedded?: { methods?: { description: string }[] } };
    methods = (data._embedded?.methods ?? []).map((m) => m.description);
    ok = true;
    message = `Verbonden (${c.mode}). Actieve betaalmethodes: ${methods.join(", ") || "geen"}.`;
  } catch (e) {
    message = e instanceof Error ? e.message : "Test mislukt";
  }
  await updateConnection("mollie", { methods, lastTest: nowTest(ok, message) });
  await audit(user, "getest", "Connectie", "mollie", message);
  return ok ? { ok, message } : fail(message);
}

export async function saveSparkpost(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    const fromEmail = str(form, "fromEmail");
    const replyTo = str(form, "replyTo");
    if (!isEmail(fromEmail)) return fail("Vul een geldig afzenderadres in.");
    if (replyTo && !isEmail(replyTo)) return fail("Vul een geldig reply-to-adres in.");
    const c = (await getConnections()).sparkpost;
    const enabled = c.enabled;
    if (enabled && !str(form, "key") && !c.keyEnc) return fail("Vul eerst een API-sleutel in.");
    await updateConnection("sparkpost", { enabled, region: str(form, "region") === "us" ? "us" : "eu", fromEmail, fromName: str(form, "fromName") || BRAND, replyTo, ...keyPatch(form, "key", "keyEnc", "keyHint") });
    await audit(user, "gewijzigd", "Connectie", "sparkpost", `SparkPost ${enabled ? "aan" : "uit"} / bijgewerkt${str(form, "key") ? " (nieuwe API-sleutel)" : ""}`);
    return { ok: true, message: "Opgeslagen." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Opslaan mislukt");
  }
}

export async function testSparkpostConnection(): Promise<ActionResult> {
  const user = await assertRole("admin");
  const c = (await getConnections()).sparkpost;
  try {
    if (!c.keyEnc) throw new Error("Er is nog geen API-sleutel ingesteld.");
    const r = await testSparkpost(c.keyEnc, c.region, c.fromEmail);
    await updateConnection("sparkpost", { domainStatus: r.domainStatus, lastTest: nowTest(true, r.message) });
    await audit(user, "getest", "Connectie", "sparkpost", r.message);
    return { ok: true, message: `${r.message} ${r.domainStatus}` };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Test mislukt";
    await updateConnection("sparkpost", { lastTest: nowTest(false, message) });
    await audit(user, "getest", "Connectie", "sparkpost", message);
    return fail(message);
  }
}

export async function sendTestMail(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    const to = str(form, "to");
    if (!isEmail(to)) return fail("Vul een geldig e-mailadres in.");
    const r = await sendMail({ to, subject: `Testmail van de webshop van ${BRAND}`, text: `Hallo,\n\nDit is een testmail, verstuurd door ${user.name} via het beheer van de webshop. Komt deze aan? Dan werkt de SparkPost-koppeling en komen bestelbevestigingen en formuliermeldingen ook aan.\n\nGroet,\n${BRAND}` }, { force: true });
    await audit(user, "verstuurd", "Connectie", "sparkpost", `Testmail naar ${to}${r.sent ? "" : ` mislukt: ${r.reason}`}`);
    revalidatePath("/admin/connecties/email/");
    return r.sent ? { ok: true, message: `Testmail verstuurd naar ${to}. Zie het verzendlog hieronder.` } : fail(r.reason);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Versturen mislukt");
  }
}

export async function saveAi(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    const provider = str(form, "provider") === "openai" ? "openai" : "anthropic";
    const c = (await getConnections()).ai;
    const enabled = c.enabled;
    if (enabled && !str(form, "key") && !c.keyEnc) return fail("Vul eerst een API-sleutel in.");
    await updateConnection("ai", { enabled, provider, model: str(form, "model"), monthlyLimit: Math.max(0, num(form, "monthlyLimit") ?? 0), ...keyPatch(form, "key", "keyEnc", "keyHint") });
    await audit(user, "gewijzigd", "Connectie", "ai", `AI-connectie (${provider}) ${enabled ? "aan" : "uit"} / bijgewerkt${str(form, "key") ? " (nieuwe API-sleutel)" : ""}`);
    return { ok: true, message: "Opgeslagen." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Opslaan mislukt");
  }
}

export async function testAiConnection(): Promise<ActionResult> {
  const user = await assertRole("admin");
  const c = (await getConnections()).ai;
  try {
    const answer = await testAi(c);
    await updateConnection("ai", { lastTest: nowTest(true, `Antwoord: ${answer}`) });
    await audit(user, "getest", "Connectie", "ai", `AI-test gelukt (${c.provider} ${c.model})`);
    return { ok: true, message: `Gelukt. Antwoord van het model: “${answer}”` };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Test mislukt";
    await updateConnection("ai", { lastTest: nowTest(false, message) });
    await audit(user, "getest", "Connectie", "ai", `AI-test mislukt: ${message}`);
    return fail(message);
  }
}

/** Aan/uit-knop op een connectiekaart. */
export async function toggleConnection(key: keyof Connections, enabled: boolean): Promise<ActionResult> {
  const user = await assertRole("admin");
  const all = await getConnections();
  if (!(key in all)) return fail("Onbekende koppeling.");
  const c = all[key] as { keyEnc?: string; containerId?: string; measurementId?: string; verification?: string; testKeyEnc?: string; liveKeyEnc?: string; placeId?: string };
  const configured = key === "googleReviews" ? !!(c.placeId && c.keyEnc) : !!(c.keyEnc || c.containerId || c.measurementId || c.verification || c.testKeyEnc || c.liveKeyEnc);
  if (enabled && !configured) return fail("Stel de koppeling eerst in.");
  await updateConnection(key, { enabled } as never);
  await audit(user, "gewijzigd", "Connectie", key, `${key} ${enabled ? "aangezet" : "uitgezet"}`);
  refresh("/");
  return { ok: true, message: enabled ? "Aangezet." : "Uitgezet." };
}
