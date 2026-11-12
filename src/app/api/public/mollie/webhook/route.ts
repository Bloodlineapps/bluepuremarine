import { db } from "@/lib/db";
import { syncMolliePayment } from "@/lib/orders";

// Mollie-webhook (form-encoded: id=tr_…). Mollie stuurt alleen een betaling-id; dat vertrouwen we nooit: de betaling
// wordt altijd opnieuw opgehaald bij Mollie en daarna verwerkt via src/lib/orders.ts. Die verwerking is idempotent,
// dus dezelfde webhook twee keer geeft geen dubbele voorraadafboeking of dubbele e-mail. Het antwoord is 200 zonder
// details (ook bij een onbekend id), zodat hier niets uit af te leiden valt. Alleen als Mollie zelf tijdelijk niet
// bereikbaar is volgt een 503: Mollie biedt de webhook dan later opnieuw aan en de betaling gaat niet verloren.

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const form = await req.formData().catch(() => null);
    const id = String(form?.get("id") ?? "");
    if (/^tr_[A-Za-z0-9]{4,40}$/.test(id)) {
      const res = await syncMolliePayment(id);
      if (res.retry) return new Response("later", { status: 503 });
      // Alleen verwerkte betalingen in het logboek: onbekende id's (iedereen kan dit adres aanroepen) vullen het niet
      if (res.ok)
        await db.auditLog
          .create({ data: { userName: "Mollie-webhook", action: "gewijzigd", entity: "Betaling", entityId: id, summary: res.message.slice(0, 300) } })
          .catch(() => {});
      else console.warn("[mollie-webhook]", id, res.message);
    }
  } catch (e) {
    console.error("[mollie-webhook]", e instanceof Error ? e.message : e);
  }
  return new Response("ok", { status: 200 });
}
