"use server";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { BCRYPT_COST, DUMMY_HASH, currentCustomer, emailSchema, endCustomerSession, hashToken, parseAddress, passwordSchema, phoneSchema, safeReturn, startCustomerSession } from "@/lib/customer";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { requestOrigin } from "@/lib/mollie";
import { resetMail } from "@/lib/order-mails";
import { rateLimit } from "@/lib/rate-limit";
import { getShop } from "@/lib/settings";

// Server actions van het klantaccount: inloggen, registreren, wachtwoord herstellen, adresboek en gegevens.
// Elke actie controleert zelf of er een klant is ingelogd en werkt alleen op de eigen gegevens van die klant.

export type AccountState = { ok?: boolean; message?: string; errors?: Record<string, string>; values?: Record<string, string> };

const SECRET = /password|wachtwoord/i;
function valuesOf(form: FormData) {
  const values: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string" && !SECRET.test(k) && !k.startsWith("$")) values[k] = v.slice(0, 300);
  return values;
}
const str = (form: FormData, k: string) => String(form.get(k) ?? "");
const first = (r: { error: z.ZodError }) => r.error.issues[0].message;
const name = (max: number, msg: string) => z.string().trim().min(1, msg).max(max, `Maximaal ${max} tekens`);

/** De ingelogde klant met wachtwoord-hash (voor controles); niet ingelogd → naar de inlogpagina. */
async function me() {
  const c = await currentCustomer();
  if (!c) redirect("/account/inloggen/");
  const row = await db.customer.findUnique({ where: { id: c.id } });
  if (!row) redirect("/account/inloggen/");
  return row;
}

// ---------- inloggen, registreren, uitloggen ----------

export async function login(_: AccountState, form: FormData): Promise<AccountState> {
  const values = valuesOf(form);
  if (!(await rateLimit("klant-login", 8, 15 * 60 * 1000))) return { values, message: "Te veel pogingen. Probeer het over een kwartier opnieuw." };
  const email = emailSchema.safeParse(str(form, "email"));
  const password = str(form, "password");
  if (!email.success || !password) return { values, message: "Vul je e-mailadres en wachtwoord in." };
  const customer = await db.customer.findUnique({ where: { email: email.data } });
  // altijd hashen, ook als het account niet bestaat (geen timing-verschil)
  const good = await bcrypt.compare(password, customer?.passwordHash ?? DUMMY_HASH);
  if (!customer || !good) return { values, message: "Onjuist e-mailadres of wachtwoord." };
  await startCustomerSession(customer);
  await db.customer.update({ where: { id: customer.id }, data: { lastLoginAt: new Date() } });
  redirect(safeReturn(str(form, "terug")));
}

export async function register(_: AccountState, form: FormData): Promise<AccountState> {
  const values = valuesOf(form);
  if (!(await rateLimit("klant-registreren", 5, 60 * 60 * 1000))) return { values, message: "Te veel pogingen. Probeer het later opnieuw." };
  const errors: Record<string, string> = {};
  const firstName = name(60, "Vul je voornaam in").safeParse(str(form, "firstName"));
  if (!firstName.success) errors.firstName = first(firstName);
  const lastName = name(80, "Vul je achternaam in").safeParse(str(form, "lastName"));
  if (!lastName.success) errors.lastName = first(lastName);
  const email = emailSchema.safeParse(str(form, "email"));
  if (!email.success) errors.email = first(email);
  const password = passwordSchema.safeParse(str(form, "password"));
  if (!password.success) errors.password = first(password);
  if (!firstName.success || !lastName.success || !email.success || !password.success) return { values, errors, message: "Nog niet alles is goed ingevuld." };
  const taken = "Er bestaat al een account met dit e-mailadres. Log in of vraag een nieuw wachtwoord aan.";
  if (await db.customer.findUnique({ where: { email: email.data }, select: { id: true } })) return { values, errors: { email: taken }, message: "Nog niet alles is goed ingevuld." };
  const newsletter = str(form, "newsletter") === "on";
  const passwordHash = await bcrypt.hash(password.data, BCRYPT_COST);
  let customer;
  try {
    customer = await db.$transaction(async (tx) => {
      const c = await tx.customer.create({ data: { email: email.data, passwordHash, firstName: firstName.data, lastName: lastName.data, newsletter, lastLoginAt: new Date() } });
      // Eerdere gastbestellingen op dit e-mailadres worden bewust NIET gekoppeld: het adres is hier nog niet
      // geverifieerd, dus wie met andermans adres registreert zou anders diens bestellingen en adressen zien.
      return c;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { values, errors: { email: taken }, message: "Nog niet alles is goed ingevuld." };
    throw e;
  }
  if (newsletter) await db.subscriber.upsert({ where: { email: customer.email }, create: { email: customer.email, source: "account" }, update: {} }).catch(() => {});
  await startCustomerSession(customer);
  redirect(safeReturn(str(form, "terug")));
}

export async function logout() {
  await endCustomerSession();
  redirect("/account/inloggen/?uit=1");
}

// ---------- wachtwoord vergeten ----------

const RESET_SENT = "Als er een account bestaat met dit e-mailadres, hebben we een e-mail gestuurd met een link om een nieuw wachtwoord te kiezen. De link is 1 uur geldig.";

export async function requestReset(_: AccountState, form: FormData): Promise<AccountState> {
  if (!(await rateLimit("klant-reset", 5, 60 * 60 * 1000))) return { message: "Te veel aanvragen. Probeer het over een uur opnieuw." };
  const email = emailSchema.safeParse(str(form, "email"));
  if (!email.success) return { values: valuesOf(form), errors: { email: first(email) } };
  const customer = await db.customer.findUnique({ where: { email: email.data } });
  if (customer) {
    const token = randomBytes(32).toString("base64url");
    // alleen de hash bewaren: wie de database kan lezen, kan daarmee geen wachtwoord opnieuw instellen
    await db.customer.update({ where: { id: customer.id }, data: { resetToken: hashToken(token), resetExpires: new Date(Date.now() + 60 * 60 * 1000) } });
    try {
      const built = await resetMail(customer.firstName, `${await requestOrigin()}/account/wachtwoord-vergeten/?token=${token}`);
      const mail = { to: customer.email, subject: built.subject, text: built.text, html: built.html };
      await sendMail(mail);
    } catch (e) {
      console.error("[account] resetmail niet verstuurd:", e instanceof Error ? e.message : e);
    }
  }
  // altijd dezelfde melding, of het adres nu bestaat of niet
  return { ok: true, message: RESET_SENT };
}

export async function resetPassword(_: AccountState, form: FormData): Promise<AccountState> {
  if (!(await rateLimit("klant-reset-zet", 10, 60 * 60 * 1000))) return { message: "Te veel pogingen. Probeer het later opnieuw." };
  const token = str(form, "token");
  const password = passwordSchema.safeParse(str(form, "password"));
  if (!password.success) return { errors: { password: first(password) } };
  if (str(form, "password2") !== password.data) return { errors: { password2: "De wachtwoorden zijn niet gelijk" } };
  const customer = /^[A-Za-z0-9_-]{20,100}$/.test(token) ? await db.customer.findFirst({ where: { resetToken: hashToken(token), resetExpires: { gt: new Date() } } }) : null;
  if (!customer) return { message: "Deze link is verlopen of al gebruikt. Vraag een nieuwe link aan." };
  const passwordHash = await bcrypt.hash(password.data, BCRYPT_COST);
  const updated = await db.customer.update({ where: { id: customer.id }, data: { passwordHash, resetToken: null, resetExpires: null, lastLoginAt: new Date() } });
  await startCustomerSession(updated);
  redirect("/account/?melding=wachtwoord");
}

// ---------- adresboek ----------

export async function saveAddress(_: AccountState, form: FormData): Promise<AccountState> {
  const customer = await me();
  const values = valuesOf(form);
  const shop = await getShop();
  const parsed = parseAddress(form, shop.shipping.map((s) => s.country));
  if (!parsed.ok) return { values, errors: parsed.errors, message: "Nog niet alles is goed ingevuld." };
  const type = str(form, "type") === "billing" ? "billing" : "shipping";
  const id = str(form, "id");
  const wantDefault = str(form, "isDefault") === "on";
  let full = false;
  await db.$transaction(async (tx) => {
    const others = await tx.address.findMany({ where: { customerId: customer.id, type, ...(id ? { id: { not: id } } : {}) }, select: { id: true, isDefault: true } });
    // het eerste adres van een soort is altijd het standaardadres
    const isDefault = wantDefault || !others.some((a) => a.isDefault);
    if (isDefault) await tx.address.updateMany({ where: { customerId: customer.id, type }, data: { isDefault: false } });
    if (id) await tx.address.updateMany({ where: { id, customerId: customer.id }, data: { ...parsed.data, type, isDefault } });
    else {
      if ((await tx.address.count({ where: { customerId: customer.id } })) >= 20) throw new Error("max");
      await tx.address.create({ data: { ...parsed.data, type, isDefault, customerId: customer.id } });
    }
  }).catch((e) => {
    if (!(e instanceof Error && e.message === "max")) throw e;
    full = true;
  });
  revalidatePath("/account/adressen/");
  redirect(full ? "/account/adressen/?melding=vol" : "/account/adressen/?melding=opgeslagen");
}

export async function deleteAddress(form: FormData) {
  const customer = await me();
  const id = str(form, "id");
  const address = await db.address.findFirst({ where: { id, customerId: customer.id } });
  if (address) {
    await db.address.deleteMany({ where: { id, customerId: customer.id } });
    if (address.isDefault) {
      const next = await db.address.findFirst({ where: { customerId: customer.id, type: address.type }, orderBy: { createdAt: "desc" } });
      if (next) await db.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }
  revalidatePath("/account/adressen/");
  redirect("/account/adressen/?melding=verwijderd");
}

export async function setDefaultAddress(form: FormData) {
  const customer = await me();
  const address = await db.address.findFirst({ where: { id: str(form, "id"), customerId: customer.id } });
  if (address)
    await db.$transaction([
      db.address.updateMany({ where: { customerId: customer.id, type: address.type }, data: { isDefault: false } }),
      db.address.updateMany({ where: { id: address.id, customerId: customer.id }, data: { isDefault: true } }),
    ]);
  revalidatePath("/account/adressen/");
  redirect("/account/adressen/?melding=standaard");
}

// ---------- gegevens ----------

export async function updateDetails(_: AccountState, form: FormData): Promise<AccountState> {
  const customer = await me();
  const values = valuesOf(form);
  const errors: Record<string, string> = {};
  const firstName = name(60, "Vul je voornaam in").safeParse(str(form, "firstName"));
  if (!firstName.success) errors.firstName = first(firstName);
  const lastName = name(80, "Vul je achternaam in").safeParse(str(form, "lastName"));
  if (!lastName.success) errors.lastName = first(lastName);
  const phone = phoneSchema.safeParse(str(form, "phone"));
  if (!phone.success) errors.phone = first(phone);
  if (!firstName.success || !lastName.success || !phone.success) return { values, errors, message: "Nog niet alles is goed ingevuld." };
  const newsletter = str(form, "newsletter") === "on";
  const updated = await db.customer.update({ where: { id: customer.id }, data: { firstName: firstName.data, lastName: lastName.data, phone: phone.data, newsletter } });
  if (newsletter) await db.subscriber.upsert({ where: { email: updated.email }, create: { email: updated.email, source: "account" }, update: {} }).catch(() => {});
  else await db.subscriber.deleteMany({ where: { email: updated.email } }).catch(() => {});
  // de voornaam staat ook in de leesbare cookie voor de header
  await startCustomerSession(updated);
  revalidatePath("/account/", "layout");
  return { ok: true, message: "Je gegevens zijn opgeslagen." };
}

export async function changeEmail(_: AccountState, form: FormData): Promise<AccountState> {
  const customer = await me();
  const values = valuesOf(form);
  if (!(await rateLimit("klant-wijzig", 10, 15 * 60 * 1000))) return { values, message: "Te veel pogingen. Probeer het over een kwartier opnieuw." };
  const email = emailSchema.safeParse(str(form, "email"));
  if (!email.success) return { values, errors: { email: first(email) } };
  if (!(await bcrypt.compare(str(form, "currentPassword"), customer.passwordHash))) return { values, errors: { currentPassword: "Dit is niet je huidige wachtwoord" } };
  if (email.data === customer.email) return { ok: true, message: "Dit is al je e-mailadres." };
  const taken = { values, errors: { email: "Dit e-mailadres is al in gebruik bij een ander account" } };
  if (await db.customer.findUnique({ where: { email: email.data }, select: { id: true } })) return taken;
  try {
    await db.customer.update({ where: { id: customer.id }, data: { email: email.data } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return taken;
    throw e;
  }
  if (customer.newsletter) {
    await db.subscriber.deleteMany({ where: { email: customer.email } }).catch(() => {});
    await db.subscriber.upsert({ where: { email: email.data }, create: { email: email.data, source: "account" }, update: {} }).catch(() => {});
  }
  revalidatePath("/account/", "layout");
  return { ok: true, message: `Je e-mailadres is gewijzigd naar ${email.data}.` };
}

export async function changePassword(_: AccountState, form: FormData): Promise<AccountState> {
  const customer = await me();
  if (!(await rateLimit("klant-wijzig", 10, 15 * 60 * 1000))) return { message: "Te veel pogingen. Probeer het over een kwartier opnieuw." };
  if (!(await bcrypt.compare(str(form, "currentPassword"), customer.passwordHash))) return { errors: { currentPassword: "Dit is niet je huidige wachtwoord" } };
  const password = passwordSchema.safeParse(str(form, "newPassword"));
  if (!password.success) return { errors: { newPassword: first(password) } };
  if (str(form, "newPassword2") !== password.data) return { errors: { newPassword2: "De wachtwoorden zijn niet gelijk" } };
  const updated = await db.customer.update({ where: { id: customer.id }, data: { passwordHash: await bcrypt.hash(password.data, BCRYPT_COST), resetToken: null, resetExpires: null } });
  // nieuwe sessie: sessies met het oude wachtwoord (andere apparaten) vervallen
  await startCustomerSession(updated);
  return { ok: true, message: "Je wachtwoord is gewijzigd." };
}
