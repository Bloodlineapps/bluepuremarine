"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { btn } from "./ui";

export function MediaUpload() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setBusy(true);
        const res = await fetch("/api/admin/upload/", { method: "POST", body: fd });
        const data = (await res.json()) as { items?: unknown[]; error?: string };
        setBusy(false);
        setMsg(data.items ? { ok: true, text: `${data.items.length} afbeelding(en) geüpload.` } : { ok: false, text: data.error ?? "Upload mislukt" });
        if (data.items) {
          (e.target as HTMLFormElement).reset();
          router.refresh();
        }
      }}
    >
      <input type="file" name="file" accept="image/*" multiple required className="block w-full text-sm" aria-label="Afbeeldingen kiezen" />
      <input name="alt" placeholder="Alt-tekst (optioneel; anders uit de bestandsnaam)" className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
      <button className={btn} disabled={busy}>
        {busy ? "Uploaden…" : "Uploaden"}
      </button>
      {msg && <p className={`text-xs ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
    </form>
  );
}
