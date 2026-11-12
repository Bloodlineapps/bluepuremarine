"use client";
import { useState } from "react";
import { btnSm, input } from "./ui";

export function CopyField({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex gap-2">
      <input readOnly value={value} className={`${input} font-mono text-xs`} aria-label="Webhook-URL" onFocus={(e) => e.target.select()} />
      <button
        type="button"
        className={btnSm}
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        }}
      >
        {done ? "Gekopieerd" : "Kopiëren"}
      </button>
    </div>
  );
}
