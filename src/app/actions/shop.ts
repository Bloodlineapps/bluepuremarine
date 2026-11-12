"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CART_COUNT_COOKIE, MAX_PER_LINE, checkDiscount, computeCart, lineKey, readCartState, writeCartState, type Cart, type CartState } from "@/lib/cart";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { getShop } from "@/lib/settings";
import { live } from "@/lib/shop";

// Server actions van de winkelwagen. Elke actie rekent de wagen opnieuw door met de gegevens uit de database en
// geeft het nieuwe aantal en totaal terug, zodat de header direct kan bijwerken.

export type CartActionResult = { ok: boolean; message?: string; count: number; total: number };

/** Wagen doorrekenen, opgeschoond terugschrijven naar de cookie en het resultaat voor de browser maken. */
async function save(state: CartState, okFlag = true, message?: string): Promise<CartActionResult & { cart: Cart }> {
  // Een wijziging in de wagen maakt hem los van een eerder geplaatste (nog onbetaalde) bestelling
  const { o: _o, ...rest } = state;
  void _o;
  const { cart, state: clean } = await computeCart(rest);
  await writeCartState(clean, cart.count);
  revalidatePath("/winkelwagen/");
  return { ok: okFlag, ...(message ? { message } : {}), count: cart.count, total: cart.total, cart };
}

const strip = ({ ok, message, count, total }: CartActionResult): CartActionResult => ({ ok, ...(message ? { message } : {}), count, total });

const toQty = (v: unknown) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? n : NaN;
};

export async function addToCart(productId: string, variantId?: string | null, quantity = 1): Promise<CartActionResult> {
  const state = await readCartState();
  const q = toQty(quantity);
  if (typeof productId !== "string" || !Number.isFinite(q) || q < 1) return strip(await save(state, false, "Dit product kan niet worden toegevoegd."));
  const product = await db.product.findFirst({ where: { id: productId, ...live }, select: { id: true, name: true, stock: true, trackStock: true, variants: { select: { id: true, stock: true } } } });
  if (!product) return strip(await save(state, false, "Dit product is niet meer verkrijgbaar."));
  const v = variantId || null;
  if (product.variants.length && !v) return strip(await save(state, false, "Kies eerst een uitvoering op de productpagina."));
  const variant = v ? product.variants.find((x) => x.id === v) : null;
  if (v && !variant) return strip(await save(state, false, "Deze uitvoering is niet meer verkrijgbaar."));
  const max = product.trackStock ? Math.min(MAX_PER_LINE, variant ? variant.stock : product.stock) : MAX_PER_LINE;
  if (max < 1) return strip(await save(state, false, "Dit product is helaas uitverkocht."));
  const existing = state.items.find((i) => i.p === product.id && i.v === v);
  const have = existing?.q ?? 0;
  if (have >= max) return strip(await save(state, false, max === 1 ? "Er is nog 1 stuk op voorraad en dat ligt al in je winkelwagen." : `Er zijn nog ${max} stuks op voorraad en die liggen al in je winkelwagen.`));
  const add = Math.min(q, max - have);
  if (existing) existing.q = have + add;
  else if (state.items.length >= 50) return strip(await save(state, false, "Je winkelwagen is vol. Reken eerst af of verwijder een artikel."));
  else state.items.push({ p: product.id, v, q: add });
  return strip(await save(state, true, add < q ? `Er waren nog maar ${add} op voorraad; die zijn toegevoegd.` : undefined));
}

export async function updateCartLine(key: string, quantity: number): Promise<CartActionResult> {
  const state = await readCartState();
  const q = toQty(quantity);
  const item = state.items.find((i) => lineKey(i.p, i.v) === key);
  if (!item || !Number.isFinite(q)) return strip(await save(state, false, "Deze regel staat niet meer in je winkelwagen."));
  if (q < 1) state.items = state.items.filter((i) => i !== item);
  else item.q = Math.min(MAX_PER_LINE, q);
  const res = await save(state);
  const line = res.cart.lines.find((l) => l.key === key);
  // aantal is door de voorraad begrensd: netjes melden
  if (line && q > line.quantity) return { ok: true, message: line.maxQuantity === 1 ? "Er is nog 1 stuk op voorraad." : `Er zijn nog ${line.maxQuantity} stuks op voorraad.`, count: res.count, total: res.total };
  return strip(res);
}

export async function removeCartLine(key: string): Promise<CartActionResult> {
  const state = await readCartState();
  state.items = state.items.filter((i) => lineKey(i.p, i.v) !== key);
  return strip(await save(state));
}

export async function applyDiscount(code: string): Promise<CartActionResult> {
  const state = await readCartState();
  const value = String(code ?? "").trim();
  if (!value) return strip(await save(state, false, "Vul een kortingscode in."));
  if (!(await rateLimit("korting", 15, 10 * 60 * 1000))) return strip(await save(state, false, "Te veel pogingen. Probeer het over een paar minuten opnieuw."));
  const { cart } = await computeCart({ ...state, code: undefined });
  if (!cart.lines.length) return strip(await save(state, false, "Je winkelwagen is leeg."));
  const check = await checkDiscount(value, cart.subtotal);
  if (!check.ok) return strip(await save(state, false, check.message));
  return strip(await save({ ...state, code: check.code }, true, "De kortingscode is toegepast."));
}

export async function removeDiscount(): Promise<CartActionResult> {
  const state = await readCartState();
  delete state.code;
  return strip(await save(state));
}

export async function setShippingCountry(country: string): Promise<CartActionResult> {
  const state = await readCartState();
  const c = String(country ?? "").toUpperCase();
  const shop = await getShop();
  if (!shop.shipping.some((s) => s.country === c)) return strip(await save(state, false, "Naar dit land verzenden we niet."));
  // `o` behouden: het land wijzigen op de afrekenpagina hoort bij dezelfde wagen
  const { cart, state: clean } = await computeCart({ ...state, country: c });
  await writeCartState(clean, cart.count);
  revalidatePath("/winkelwagen/");
  return { ok: true, count: cart.count, total: cart.total };
}

/** Aantal en totaal voor de header. Schrijft meteen de opgeschoonde wagen terug (verdwenen producten, voorraad). */
export async function getCartSummary(): Promise<CartActionResult> {
  const state = await readCartState();
  const { cart, state: clean } = await computeCart(state);
  // Alleen schrijven als er iets veranderd is: een cookie zetten laat de pagina opnieuw renderen
  const shown = (await cookies()).get(CART_COUNT_COOKIE)?.value;
  if (JSON.stringify(clean) !== JSON.stringify(state) || (state.items.length > 0 && shown !== String(cart.count))) await writeCartState(clean, cart.count);
  return { ok: true, count: cart.count, total: cart.total };
}

// ---------- varianten voor gewone formulieren (werken ook zonder JavaScript) ----------

/** Productpagina zonder JavaScript: toevoegen en door naar de winkelwagen. */
export async function addToCartForm(form: FormData) {
  const res = await addToCart(String(form.get("productId") ?? ""), String(form.get("variantId") ?? "") || null, toQty(form.get("quantity") ?? 1) || 1);
  redirect(res.ok ? "/winkelwagen/" : "/winkelwagen/?melding=toevoegen");
}

export async function updateCartLineForm(form: FormData) {
  await updateCartLine(String(form.get("key") ?? ""), toQty(form.get("quantity")));
}

export async function removeCartLineForm(form: FormData) {
  await removeCartLine(String(form.get("key") ?? ""));
}

export async function removeDiscountForm() {
  await removeDiscount();
}

export async function setShippingCountryForm(form: FormData) {
  await setShippingCountry(String(form.get("country") ?? ""));
}

export type DiscountFormState = { ok?: boolean; message?: string };
export async function applyDiscountForm(_: DiscountFormState, form: FormData): Promise<DiscountFormState> {
  const res = await applyDiscount(String(form.get("code") ?? ""));
  return { ok: res.ok, message: res.message };
}
