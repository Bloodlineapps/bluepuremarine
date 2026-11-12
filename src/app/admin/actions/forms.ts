"use server";
import fs from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/components/admin/fields";
import { audit } from "@/lib/admin/audit";
import { bool, isRedirect, normalizePath, opt, refresh, str } from "@/lib/admin/common";
import { ensureBaseline, snapshot } from "@/lib/admin/revisions";
import { assertRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { FIELD_TYPES, type FormStep } from "@/lib/forms";
import { slugify } from "@/lib/text";

const fail = (error: string): ActionResult => ({ error });

function cleanSteps(raw: string): FormStep[] {
  let steps: FormStep[];
  try {
    steps = JSON.parse(raw);
  } catch {
    throw new Error("De velden konden niet gelezen worden.");
  }
  if (!Array.isArray(steps) || !steps.length) throw new Error("Een formulier heeft minstens één stap nodig.");
  const ids = new Set<string>();
  return steps.map((s, i) => ({
    id: String(s.id || `s${i + 1}`),
    title: String(s.title || `Stap ${i + 1}`).slice(0, 80),
    fields: (s.fields ?? []).map((f) => {
      if (!(f.type in FIELD_TYPES)) throw new Error(`Onbekend veldtype: ${f.type}`);
      let id = slugify(f.id || f.label || "veld").replace(/-/g, "_").slice(0, 40) || "veld";
      while (ids.has(id)) id = `${id}_2`;
      ids.add(id);
      if (!String(f.label || "").trim()) throw new Error("Elk veld heeft een label nodig.");
      if (["select", "radio", "checkbox"].includes(f.type) && !(f.options ?? []).filter(Boolean).length) throw new Error(`Het veld "${f.label}" heeft keuzeopties nodig.`);
      if (f.pattern) {
        try {
          new RegExp(f.pattern);
        } catch {
          throw new Error(`Het patroon bij "${f.label}" is geen geldige reguliere expressie.`);
        }
      }
      return {
        id,
        type: f.type,
        label: String(f.label).slice(0, 120),
        placeholder: f.placeholder?.slice(0, 120) || undefined,
        help: f.help?.slice(0, 300) || undefined,
        required: !!f.required,
        options: ["select", "radio", "checkbox"].includes(f.type) ? (f.options ?? []).map((o: string) => o.trim()).filter(Boolean) : undefined,
        min: f.min ?? undefined,
        max: f.max ?? undefined,
        pattern: f.pattern || undefined,
        patternMessage: f.patternMessage || undefined,
        accept: f.type === "file" ? f.accept || ".pdf,.doc,.docx" : undefined,
        autocomplete: f.autocomplete || undefined,
      };
    }),
  }));
}

export async function saveForm(id: string | null, _: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const name = str(form, "name");
    if (name.length < 2) return fail("Geef het formulier een naam.");
    const key = slugify(str(form, "key") || name);
    if (!key) return fail("Vul een sleutel in.");
    const clash = await db.form.findFirst({ where: { key, ...(id ? { id: { not: id } } : {}) } });
    if (clash) return fail("Deze sleutel is al in gebruik door een ander formulier.");
    const emails = str(form, "notifyEmails")
      .split(/[\s,;]+/)
      .filter(Boolean);
    const badMail = emails.find((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e));
    if (badMail) return fail(`Ongeldig e-mailadres: ${badMail}`);
    const after = str(form, "afterSubmit") === "redirect" ? "redirect" : "message";
    const redirectPath = after === "redirect" ? normalizePath(str(form, "redirectPath")) : null;
    if (after === "redirect" && !redirectPath) return fail("Vul een geldige pagina in om naar door te sturen, bijvoorbeeld /bedankt-voor-je-reactie/.");
    const webhookUrl = opt(form, "webhookUrl");
    if (webhookUrl && !/^https:\/\//.test(webhookUrl)) return fail("De webhook-URL moet met https:// beginnen.");
    if (id) await ensureBaseline("form", id, user);
    const data = {
      key,
      name,
      description: str(form, "description"),
      steps: JSON.stringify(cleanSteps(str(form, "steps"))),
      submitLabel: str(form, "submitLabel") || "Versturen",
      notifyEmails: JSON.stringify(emails),
      notifySubject: str(form, "notifySubject") || "Nieuwe inzending: {formulier}",
      afterSubmit: after,
      successMessage: str(form, "successMessage") || "Bedankt! We nemen zo snel mogelijk contact met je op.",
      redirectPath,
      confirmEnabled: bool(form, "confirmEnabled"),
      confirmSubject: str(form, "confirmSubject"),
      confirmText: str(form, "confirmText"),
      webhookUrl,
      status: str(form, "status") === "draft" ? "draft" : "published",
    };
    if (id) {
      await db.form.update({ where: { id }, data });
      await snapshot("form", id, user);
      await audit(user, "gewijzigd", "Formulier", id, `${name} bijgewerkt`);
      refresh("/");
      return { ok: true, message: "Opgeslagen." };
    }
    const created = await db.form.create({ data });
    await snapshot("form", created.id, user);
    await audit(user, "aangemaakt", "Formulier", created.id, `${name} aangemaakt`);
    redirect(`/admin/formulieren/${created.id}/bewerken/?nieuw=1`);
  } catch (e) {
    if (isRedirect(e)) throw e;
    return fail(e instanceof Error ? e.message : "Opslaan mislukt");
  }
}

export async function duplicateForm(id: string) {
  const user = await assertRole("user");
  const f = await db.form.findUniqueOrThrow({ where: { id } });
  let key = `${f.key}-kopie`;
  for (let i = 2; await db.form.findUnique({ where: { key } }); i++) key = `${f.key}-kopie-${i}`;
  const { id: _id, createdAt: _c, updatedAt: _u, deletedAt: _d, ...rest } = f;
  void _id, _c, _u, _d;
  const copy = await db.form.create({ data: { ...rest, key, name: `${f.name} (kopie)`, status: "draft" } });
  await audit(user, "aangemaakt", "Formulier", copy.id, `${f.name} gedupliceerd`);
  redirect(`/admin/formulieren/${copy.id}/bewerken/?nieuw=1`);
}

/** Inzendingen: gelezen/ongelezen en verwijderen (in bulk). Verwijderen van inzendingen is definitief (AVG). */
export async function bulkSubmissions(formId: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const action = str(form, "bulk");
    const ids = form.getAll("ids").map(String);
    if (!ids.length) return fail("Selecteer eerst inzendingen.");
    if (action === "read" || action === "unread") {
      const r = await db.formSubmission.updateMany({ where: { id: { in: ids }, formId }, data: { read: action === "read" } });
      return { ok: true, message: `${r.count} inzendingen bijgewerkt.` };
    }
    if (action === "delete") {
      await assertRole("user");
      for (const id of ids) await fs.rm(path.join(process.cwd(), "storage", "forms", id), { recursive: true, force: true });
      const r = await db.formSubmission.deleteMany({ where: { id: { in: ids }, formId } });
      await audit(user, "verwijderd", "Inzending", formId, `${r.count} inzendingen definitief verwijderd`);
      return { ok: true, message: `${r.count} inzendingen definitief verwijderd.` };
    }
    return fail("Kies een actie.");
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Mislukt");
  }
}

export async function markRead(id: string) {
  await assertRole("user");
  await db.formSubmission.update({ where: { id }, data: { read: true } });
}
