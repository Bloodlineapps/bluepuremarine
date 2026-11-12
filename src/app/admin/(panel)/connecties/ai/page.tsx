import { saveAi, testAiConnection, toggleConnection } from "@/app/admin/actions/manage";
import { ConnectionCard } from "@/components/admin/ConnectionCard";
import { SimpleForm } from "@/components/admin/SimpleForm";
import { Field, input } from "@/components/admin/ui";
import { AI_MODELS } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { getConnections } from "@/lib/settings";

export const metadata = { title: "Connecties: AI" };

export default async function AiTab() {
  await requireUser("admin");
  const a = (await getConnections()).ai;
  const month = new Date().toISOString().slice(0, 7);
  const used = a.usage?.month === month ? a.usage.count : 0;
  return (
    <ConnectionCard title="AI" description="Gebruikt in het beheer voor voorstellen voor meta-descriptions van pagina's, producten, categorieën en blogs. Alle verzoeken lopen via de eigen server; de sleutel komt nooit in de browser." status={{ configured: !!a.keyEnc, enabled: a.enabled, lastTest: a.lastTest }} toggle={toggleConnection.bind(null, "ai")} test={testAiConnection}>
      <SimpleForm action={saveAi}>
        <input type="hidden" name="enabled" value={a.enabled ? "on" : ""} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Provider">
            <select name="provider" defaultValue={a.provider} className={input}>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI</option>
            </select>
          </Field>
          <Field label="Model" hint="(bij OpenAI vrij in te vullen)">
            <input name="model" list="ai-models" defaultValue={a.model} className={`${input} font-mono`} />
            <datalist id="ai-models">
              {AI_MODELS.anthropic.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Field>
          <Field label="API-sleutel" hint={a.keyHint ? `(ingesteld ${a.keyHint}; leeg = behouden)` : ""}>
            <input name="key" type="password" autoComplete="off" className={`${input} font-mono`} placeholder={a.keyHint || ""} />
          </Field>
          <Field label="Maandlimiet (aantal verzoeken, 0 = geen)" hint={`(deze maand: ${used})`}>
            <input name="monthlyLimit" type="number" min={0} defaultValue={a.monthlyLimit} className={input} />
          </Field>
        </div>
      </SimpleForm>
    </ConnectionCard>
  );
}
