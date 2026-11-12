"use server";
import type { ActionResult } from "@/components/admin/fields";
import { audit } from "@/lib/admin/audit";
import { refresh } from "@/lib/admin/common";
import { assertRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEFAULT_MENUS, getMenus, type MenuNode } from "@/lib/menu";
import { saveSetting } from "@/lib/settings";

// Menu's opslaan. Validatie: labels verplicht, maximaal 7 items in het hoofdmenu, links naar een bestaande pagina
// (vaste sleutel) of een geldige URL, maximaal drie niveaus diep. De categorieën van de webshop staan automatisch
// in het megamenu; het hoofdmenu hier bevat de extra links erachter.

function clean(nodes: MenuNode[], depth: number, keys: Set<string>, errors: string[]): MenuNode[] {
  return nodes.map((n, i) => {
    const label = String(n.label ?? "").trim().slice(0, 80);
    if (!label) errors.push(`Item ${i + 1} heeft geen naam.`);
    const key = n.key ? String(n.key) : null;
    if (key && !keys.has(key)) errors.push(`"${label}" verwijst naar een pagina die niet bestaat (${key}).`);
    const href = !key && n.href ? String(n.href).trim() : null;
    if (href && !/^(https?:\/\/|\/|mailto:|tel:)/.test(href)) errors.push(`"${label}": een link begint met /, https://, mailto: of tel:.`);
    const children = depth < 3 && n.children?.length ? clean(n.children, depth + 1, keys, errors) : undefined;
    return { id: String(n.id || Math.random().toString(36).slice(2, 8)), label, key, href, ...(children?.length ? { children } : {}) };
  });
}

export async function saveMenus(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const raw = JSON.parse(String(form.get("menus") ?? "{}")) as { main?: MenuNode[]; footer?: MenuNode[] };
    const keys = new Set((await db.page.findMany({ where: { deletedAt: null }, select: { translationKey: true } })).map((p) => p.translationKey));
    const errors: string[] = [];
    const main = clean(raw.main ?? [], 1, keys, errors);
    const footer = clean(raw.footer ?? [], 1, keys, errors);
    if (main.length > 7) errors.push("Het hoofdmenu mag maximaal 7 items hebben.");
    if (errors.length) return { error: errors.slice(0, 5).join(" ") };
    const all = await getMenus();
    await saveSetting("menus", { ...all, nl: { main, footer } });
    await audit(user, "gewijzigd", "Menu", "nl", "Menu's aangepast");
    refresh();
    return { ok: true, message: "Menu's opgeslagen en direct zichtbaar op de website." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Opslaan mislukt" };
  }
}

export async function resetMenus(): Promise<ActionResult> {
  try {
    const user = await assertRole("user");
    const all = await getMenus();
    await saveSetting("menus", { ...all, nl: DEFAULT_MENUS.nl });
    await audit(user, "gewijzigd", "Menu", "nl", "Menu's teruggezet naar de standaard");
    refresh();
    return { ok: true, message: "Standaardmenu teruggezet. Ververs de pagina om het te zien." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Terugzetten mislukt" };
  }
}
