"use server";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { after } from "next/server";
import { db } from "@/lib/db";
import { parseSteps, validateField, type FormField } from "@/lib/forms";
import { fill, sendMail } from "@/lib/mail";
import { rateLimit } from "@/lib/rate-limit";
import { parse } from "@/lib/json";
import { dict } from "@/lib/i18n";
import { live } from "@/lib/shop";

// Publieke server actions: formulieren uit de formulierbouwer, nieuwsbriefinschrijving en productreviews.
// Formulieren: altijd rate limiting, honeypot, minimale invultijd, validatie per veld op de server en opslaan in
// de database (ook als de e-mail niet aankomt); daarna pas e-mail en webhook (op de achtergrond, zodat de bezoeker
// niet hoeft te wachten). Bijlagen komen in storage/forms/ — buiten de publieke map, alleen te downloaden in het beheer.

export type FormState = { ok: boolean; message?: string; errors?: Record<string, string>; redirect?: string; values?: Record<string, string> };

const STORAGE = path.join(process.cwd(), "storage", "forms");

export async function submitForm(formKey: string, _: FormState, data: FormData): Promise<FormState> {
  const locale = "nl" as const;
  const t = dict(locale).form;
  const form = await db.form.findFirst({ where: { key: formKey, status: "published", deletedAt: null } });
  if (!form) return { ok: false, message: t.unavailable };

  // spam: honeypot + minimaal 3 seconden invultijd + rate limit
  if (String(data.get("website") ?? "")) return { ok: true, message: form.successMessage };
  const started = Number(data.get("_t") ?? 0);
  if (started && Date.now() - started < 3000) return { ok: false, message: t.tooFast };
  if (!(await rateLimit(`form:${formKey}`, 5, 10 * 60_000))) return { ok: false, message: t.rateLimited };

  const fields: FormField[] = parseSteps(form.steps).flatMap((s) => s.fields);
  const values: Record<string, string | string[]> = {};
  const files: { field: string; file: File }[] = [];
  const errors: Record<string, string> = {};
  for (const f of fields) {
    if (f.type === "file") {
      const file = data.get(f.id);
      const real = file instanceof File && file.size > 0 ? file : null;
      const err = validateField(f, real ? { name: real.name, size: real.size } : null, locale);
      if (err) errors[f.id] = err;
      else if (real) files.push({ field: f.id, file: real });
      continue;
    }
    const v = f.type === "checkbox" ? data.getAll(f.id).map(String) : String(data.get(f.id) ?? "").trim();
    const err = validateField(f, v, locale);
    if (err) errors[f.id] = err;
    values[f.id] = v;
  }
  const echo = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Array.isArray(v) ? v.join("|") : v]));
  if (Object.keys(errors).length) return { ok: false, message: t.checkFields, errors, values: echo };

  const sub = await db.formSubmission.create({ data: { formId: form.id, data: JSON.stringify(values), sourcePath: String(data.get("_path") ?? "").slice(0, 200) || null } });
  const saved: { field: string; name: string; path: string; size: number }[] = [];
  if (files.length) {
    const dir = path.join(STORAGE, sub.id);
    await fs.mkdir(dir, { recursive: true });
    for (const { field, file } of files) {
      const safe = `${crypto.randomBytes(4).toString("hex")}-${file.name.replace(/[^a-z0-9._-]+/gi, "_").slice(-80)}`;
      await fs.writeFile(path.join(dir, safe), Buffer.from(await file.arrayBuffer()));
      saved.push({ field, name: file.name, path: `${sub.id}/${safe}`, size: file.size });
    }
    await db.formSubmission.update({ where: { id: sub.id }, data: { files: JSON.stringify(saved) } });
  }

  // e-mail en webhook na het antwoord aan de bezoeker
  after(async () => {
    const label = (id: string) => fields.find((f) => f.id === id)?.label ?? id;
    const lines = Object.entries(values)
      .filter(([, v]) => (Array.isArray(v) ? v.length : v))
      .map(([k, v]) => `${label(k)}: ${Array.isArray(v) ? v.join(", ") : v}`);
    if (saved.length) lines.push(`Bijlagen: ${saved.map((s) => s.name).join(", ")} (te downloaden in het beheer)`);
    const vars: Record<string, string> = { formulier: form.name, ...Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : v])) };
    const email = fields.find((f) => f.type === "email");
    const replyTo = email ? String(values[email.id] ?? "") : undefined;
    let mailStatus = "niet ingesteld";
    try {
      const to = parse<string[]>(form.notifyEmails, []);
      if (to.length) {
        const r = await sendMail({ to, subject: fill(form.notifySubject, vars), text: `${fill(form.notifySubject, vars)}\n\n${lines.join("\n")}\n\nBekijk de inzending in het beheer: /admin/formulieren/${form.id}/inzendingen/${sub.id}/`, replyTo });
        mailStatus = r.sent ? "verstuurd" : "niet ingesteld";
      }
      if (form.confirmEnabled && replyTo && form.confirmText.trim()) await sendMail({ to: replyTo, subject: fill(form.confirmSubject, vars), text: fill(form.confirmText, vars) });
    } catch {
      mailStatus = "mislukt";
    }
    let webhookStatus: string | null = null;
    if (form.webhookUrl) {
      try {
        const res = await fetch(form.webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ form: form.key, id: sub.id, createdAt: sub.createdAt, data: values, files: saved.map((s) => s.name) }), signal: AbortSignal.timeout(10_000) });
        webhookStatus = `HTTP ${res.status}`;
      } catch (e) {
        webhookStatus = `fout: ${e instanceof Error ? e.message : e}`.slice(0, 200);
      }
    }
    await db.formSubmission.update({ where: { id: sub.id }, data: { mailStatus, webhookStatus } });
  });

  if (form.afterSubmit === "redirect" && form.redirectPath) return { ok: true, redirect: form.redirectPath };
  const first = String(values.voornaam ?? values.naam ?? "").split(" ")[0];
  return { ok: true, message: fill(form.successMessage, { voornaam: first, naam: first }) };
}

// ---------- nieuwsbrief (footer) ----------

export type SimpleState = { ok: boolean; message?: string; errors?: Record<string, string>; values?: Record<string, string> };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Inschrijven voor de nieuwsbrief: honeypot, rate limit, opslaan in Subscriber (dubbele adressen zijn geen fout). */
export async function subscribeNewsletter(_: SimpleState, data: FormData): Promise<SimpleState> {
  const t = dict("nl").newsletter;
  if (String(data.get("website") ?? "")) return { ok: true, message: t.success };
  const email = String(data.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 200) return { ok: false, message: t.invalid, values: { email } };
  if (!(await rateLimit("newsletter", 5, 10 * 60_000))) return { ok: false, message: t.rateLimited, values: { email } };
  try {
    const existing = await db.subscriber.findUnique({ where: { email } });
    if (existing) return { ok: true, message: t.already };
    await db.subscriber.create({ data: { email, source: "footer" } });
    return { ok: true, message: t.success };
  } catch {
    return { ok: false, message: t.error, values: { email } };
  }
}

// ---------- productreview ----------

/** Review bij een product: komt als "pending" binnen en staat pas op de site na goedkeuring in /admin/reviews/. */
export async function submitReview(productId: string, _: SimpleState, data: FormData): Promise<SimpleState> {
  const t = dict("nl").review;
  if (String(data.get("website") ?? "")) return { ok: true, message: t.success };
  const started = Number(data.get("_t") ?? 0);
  const values = {
    name: String(data.get("name") ?? "").trim(),
    email: String(data.get("email") ?? "").trim().toLowerCase(),
    rating: String(data.get("rating") ?? ""),
    title: String(data.get("title") ?? "").trim(),
    text: String(data.get("text") ?? "").trim(),
  };
  if (started && Date.now() - started < 3000) return { ok: false, message: dict("nl").form.tooFast, values };
  const rating = Number(values.rating);
  const errors: Record<string, string> = {};
  if (values.name.length < 2) errors.name = t.nameRequired;
  else if (values.name.length > 80) errors.name = t.tooLong;
  if (values.email && (!EMAIL.test(values.email) || values.email.length > 200)) errors.email = dict("nl").form.invalidEmail;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) errors.rating = t.ratingRequired;
  if (values.title.length > 120) errors.title = t.tooLong;
  if (values.text.length < 10) errors.text = t.textRequired;
  else if (values.text.length > 3000) errors.text = t.tooLong;
  if (Object.keys(errors).length) return { ok: false, message: t.checkFields, errors, values };
  if (!(await rateLimit("review", 3, 60 * 60_000))) return { ok: false, message: t.rateLimited, values };
  try {
    const product = await db.product.findFirst({ where: { id: productId, ...live }, select: { id: true } });
    if (!product) return { ok: false, message: t.unavailable };
    await db.review.create({ data: { productId: product.id, name: values.name, email: values.email || null, rating, title: values.title, text: values.text, status: "pending", source: "site" } });
    return { ok: true, message: t.success };
  } catch {
    return { ok: false, message: t.error, values };
  }
}
