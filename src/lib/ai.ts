import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { decrypt } from "./crypto";
import { getConnections, saveSetting, type Connections } from "./settings";
import { db } from "./db";

// Alle AI-verzoeken lopen via de eigen server; de API-sleutel komt nooit in de browser.
// - Anthropic (Claude): tekst — connectietest en meta-descriptions in het beheer.
// - OpenAI: tekst. Optioneel een maandlimiet (aantal verzoeken), bijgehouden in de connectie-instellingen.

export const AI_MODELS = {
  anthropic: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"],
  openai: [] as string[], // vrij invulbaar; kies een actueel tekstmodel van OpenAI
};

type Ai = Connections["ai"];

function ready(ai: Ai) {
  return ai.enabled && !!ai.keyEnc && !!decrypt(ai.keyEnc);
}

async function anthropicText(ai: Ai, system: string, prompt: string, maxTokens: number) {
  const client = new Anthropic({ apiKey: decrypt(ai.keyEnc), timeout: 60_000, maxRetries: 1 });
  const res = await client.beta.messages.create({
    model: ai.model || "claude-opus-5-5",
    max_tokens: maxTokens,
    system,
    output_config: { effort: "low" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    messages: [{ role: "user", content: prompt }],
  } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming);
  if (res.stop_reason === "refusal") throw new Error("Het model weigerde dit verzoek.");
  return res.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

async function openaiText(ai: Ai, system: string, prompt: string, maxTokens: number) {
  if (!ai.model) throw new Error("Kies eerst een OpenAI-model in de connectie.");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${decrypt(ai.keyEnc)}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: ai.model, max_completion_tokens: maxTokens, messages: [{ role: "system", content: system }, { role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(60_000),
  });
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
  if (!res.ok) throw new Error(data.error?.message || `OpenAI gaf status ${res.status}`);
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

export async function aiText(system: string, prompt: string, maxTokens = 1024, override?: Ai) {
  const ai = override ?? (await getConnections()).ai;
  if (!ai.keyEnc || !decrypt(ai.keyEnc)) throw new Error("Er is nog geen API-sleutel ingesteld.");
  if (!override && !ai.enabled) throw new Error("De AI-connectie staat uit.");
  if (!override) await countUsage(ai);
  return ai.provider === "anthropic" ? anthropicText(ai, system, prompt, maxTokens) : openaiText(ai, system, prompt, maxTokens);
}

/** Korte testvraag voor de knop "Verbinding testen". */
export async function testAi(ai: Ai) {
  const answer = await aiText("Je antwoordt kort, in het Nederlands.", "Antwoord met precies: verbinding gelukt", 256, { ...ai, enabled: true });
  return answer.slice(0, 120);
}

/** Meta-description (140–160 tekens) op basis van titel en inhoud van een pagina, product, categorie of blog. */
export async function aiMetaDescription(title: string, content: string, _locale?: string) {
  void _locale; // de site is alleen Nederlandstalig
  const text = await aiText(
    "Je bent SEO-copywriter voor BluePure Marine, een Nederlandse webshop met eigen reinigings- en onderhoudsmiddelen voor boten en met bootonderdelen, navigatie-elektronica en watersportartikelen van bekende merken. Schrijf in het Nederlands, spreek de lezer aan met je: helder, nuchter en behulpzaam, zonder overdreven claims, zonder verzonnen cijfers, prijzen of levertijden en zonder aanhalingstekens.",
    `Schrijf één meta description van 140 tot 160 tekens voor "${title}". Beschrijf wat de bezoeker vindt en eindig met een reden om te klikken. Geef alleen de tekst terug.

Inhoud:
${content.slice(0, 6000)}`,
    1024,
  );
  return text.replace(/^["'“]|["'”]$/g, "").trim();
}

/** Maandlimiet bewaken: telt elk verzoek; boven de limiet weigert de server. */
async function countUsage(ai: Ai) {
  const month = new Date().toISOString().slice(0, 7);
  const usage = ai.usage?.month === month ? ai.usage : { month, count: 0 };
  if (ai.monthlyLimit > 0 && usage.count >= ai.monthlyLimit) throw new Error(`De maandlimiet van ${ai.monthlyLimit} AI-verzoeken is bereikt.`);
  const row = await db.setting.findUnique({ where: { key: "connections" } });
  const all = row ? (JSON.parse(row.value) as Record<string, unknown>) : {};
  await saveSetting("connections", { ...all, ai: { ...ai, usage: { month, count: usage.count + 1 } } });
}

/** Is de AI-hulp (meta-voorstellen) beschikbaar in het beheer? */
export async function aiEnabled() {
  const { ai } = await getConnections();
  return ai.enabled && !!ai.keyEnc;
}
