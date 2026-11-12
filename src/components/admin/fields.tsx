"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { btn, btnDanger, btnSm, input } from "./ui";

// Herbruikbare velden voor de beheerformulieren (client-side).

export type ActionResult = { ok?: boolean; message?: string; error?: string; errors?: Record<string, string> };

/**
 * Formulier zelf versturen in plaats van via action=…. React zet een formulier na een form-action terug naar de
 * waarden waarmee de pagina geladen is: keuzelijsten (status, btw, merk, modus …) sprongen daardoor na het opslaan
 * terug naar de oude waarde, en een tweede keer opslaan zette die oude waarde ongemerkt weer in de database. Na een
 * foutmelding raakte bovendien alles wat was ingevuld leeg. `reset` leegt het formulier na een geslaagde actie
 * (voor "toevoegen"-formulieren).
 */
export function useKeepValues(formAction: (data: FormData) => void) {
  const [, start] = useTransition();
  return (e: React.FormEvent<HTMLFormElement>) => {
    if (e.defaultPrevented) return;
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const data = new FormData(e.currentTarget, submitter instanceof HTMLButtonElement && submitter.name ? submitter : undefined);
    start(() => formAction(data));
  };
}
type Media = { id: string; path: string; alt: string; width: number | null; height: number | null };

/** Formulier met opslaan-balk en meldingen. De action valideert en controleert rechten op de server. */
export function AdminForm({ action, children, readOnly, submitLabel = "Opslaan", aside }: { action: (s: ActionResult, f: FormData) => Promise<ActionResult>; children: React.ReactNode; readOnly?: boolean; submitLabel?: string; aside?: React.ReactNode }) {
  const [state, formAction, pending] = useActionState(action, {});
  const submit = useKeepValues(formAction);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (state.ok) setDirty(false);
  }, [state]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  return (
    <form action={formAction} onSubmit={submit} onChange={() => setDirty(true)} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <fieldset disabled={readOnly} className="min-w-0 space-y-6">
        {(state.message || state.error) && (
          <p role="status" className={`rounded-xl px-4 py-3 text-sm ${state.error ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>
            {state.error ?? state.message}
          </p>
        )}
        {children}
      </fieldset>
      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        {!readOnly ? (
          <div className="rounded-2xl border border-line bg-white p-5">
            <button className={`${btn} w-full`} disabled={pending}>
              {pending ? "Opslaan…" : submitLabel}
            </button>
            <p className="mt-2 text-center text-xs text-ink-soft">{dirty ? "Niet-opgeslagen wijzigingen" : "Alles is opgeslagen"}</p>
          </div>
        ) : (
          <p className="rounded-2xl border border-line bg-white p-5 text-sm text-ink-soft">Je kunt dit alleen bekijken.</p>
        )}
        {aside}
      </aside>
    </form>
  );
}

export function ErrorText({ text }: { text?: string }) {
  return text ? <span className="mt-1 block text-xs text-danger">{text}</span> : null;
}

/** Tekenteller voor meta-velden met bandbreedte (bv. 45–60 tekens). */
export function CountedInput({ name, defaultValue, min, max, textarea, placeholder }: { name: string; defaultValue?: string | null; min: number; max: number; textarea?: boolean; placeholder?: string }) {
  const [v, setV] = useState(defaultValue ?? "");
  const ok = v.length >= min && v.length <= max;
  const props = { name, value: v, placeholder, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV(e.target.value), className: input };
  return (
    <div>
      {textarea ? <textarea {...props} rows={3} /> : <input {...props} />}
      <span className={`mt-1 block text-xs ${v.length === 0 ? "text-ink-soft" : ok ? "text-success" : "text-[#9a6b00]"}`}>
        {v.length} tekens · advies {min}–{max}
      </span>
      <SetterBridge name={name} onSet={setV} />
    </div>
  );
}

/** Laat andere componenten (zoals de AI-knop) een veldwaarde zetten via een custom event. */
function SetterBridge({ name, onSet }: { name: string; onSet: (v: string) => void }) {
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent<{ name: string; value: string }>).detail;
      if (d.name === name) onSet(d.value);
    };
    window.addEventListener("admin:set", h);
    return () => window.removeEventListener("admin:set", h);
  }, [name, onSet]);
  return null;
}

/** SEO-blok: meta-title, meta-description (met AI-voorstel) en uitgelichte afbeelding. */
export function SeoFields({ metaTitle, metaDescription, aiAction, aiEnabled, ogImage, showOg, path }: { metaTitle?: string | null; metaDescription?: string | null; aiAction?: (fd: FormData) => Promise<{ text?: string; error?: string }>; aiEnabled?: boolean; ogImage?: string | null; showOg?: boolean; path?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const suggest = async () => {
    const form = ref.current?.closest("form");
    if (!form || !aiAction) return;
    setBusy(true);
    setErr(null);
    const res = await aiAction(new FormData(form));
    setBusy(false);
    if (res.text) window.dispatchEvent(new CustomEvent("admin:set", { detail: { name: "metaDescription", value: res.text } }));
    else setErr(res.error ?? "Mislukt");
  };
  return (
    <div ref={ref} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-ink-soft">Meta-title (zoekresultaat en social preview)</span>
        <CountedInput name="metaTitle" defaultValue={metaTitle} min={45} max={60} placeholder="Leeg = automatisch: titel | BluePure Marine" />
      </label>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-medium text-ink-soft">Meta-description</span>
          {aiAction && (
            <button type="button" className={btnSm} onClick={suggest} disabled={busy || !aiEnabled} title={aiEnabled ? "" : "Stel eerst de AI-connectie in"}>
              <Icon name="sparkle" className="h-3.5 w-3.5" /> {busy ? "Bezig…" : "Voorstel met AI"}
            </button>
          )}
        </div>
        <CountedInput name="metaDescription" defaultValue={metaDescription} min={140} max={160} textarea placeholder="Leeg = automatisch uit de tekst" />
        {err && <ErrorText text={err} />}
      </div>
      {showOg && <ImageField name="ogImage" value={ogImage} label="Deel-afbeelding (voorvertoning op WhatsApp, Facebook en LinkedIn) — leeg = uitgelichte afbeelding" />}
      <SnippetPreview path={path} />
    </div>
  );
}

const plainText = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const cut = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1).replace(/\s+\S*$/, "")}…` : t);

/** Live voorvertoning: zo ziet de pagina eruit in Google en als hij gedeeld wordt. Leest de velden van het formulier. */
export function SnippetPreview({ path }: { path?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [v, setV] = useState({ title: "", desc: "", image: "", url: "" });
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const read = () => {
      const fd = new FormData(form);
      const get = (k: string) => String(fd.get(k) ?? "").trim();
      const name = get("title") || get("name");
      const title = get("metaTitle") || (name ? `${name} | BluePure Marine` : "Titel van de pagina | BluePure Marine");
      const desc = get("metaDescription") || cut(plainText(get("excerpt") || get("intro") || get("lead") || get("summary") || get("description") || get("content") || get("html")), 158);
      let image = get("ogImage") || get("heroImage") || get("image");
      if (!image) {
        try {
          image = (JSON.parse(get("images") || "[]") as { src: string }[])[0]?.src ?? "";
        } catch {
          image = "";
        }
      }
      const p = get("path") || (get("slug") ? `/blog/${get("slug")}/` : path) || "/";
      setV({ title, desc, image, url: `www.bluepuremarine.com${p.replace(/\/$/, "").replace(/\//g, " › ")}` });
    };
    read();
    form.addEventListener("input", read);
    form.addEventListener("change", read);
    const t = setInterval(read, 1500); // ook wijzigingen via de mediakiezer en de editor oppikken
    return () => {
      form.removeEventListener("input", read);
      form.removeEventListener("change", read);
      clearInterval(t);
    };
  }, [path]);
  return (
    <div ref={ref} className="grid gap-4 border-t border-line pt-4 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-medium text-ink-soft">Voorvertoning in Google</p>
        <div className="rounded-xl border border-line bg-white p-4 font-[arial,sans-serif]">
          <p className="truncate text-xs text-[#4d5156]">{v.url}</p>
          <p className="mt-1 line-clamp-1 text-lg leading-snug text-[#1a0dab]">{cut(v.title, 62)}</p>
          <p className="mt-1 line-clamp-2 text-sm text-[#4d5156]">{v.desc || "Vul een meta-description in of schrijf eerst tekst."}</p>
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium text-ink-soft">Voorvertoning bij delen</p>
        <div className="overflow-hidden rounded-xl border border-line bg-[#f0f2f5]">
          {v.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.image} alt="" className="aspect-[1.91/1] w-full object-cover" />
          ) : (
            <div className="grid aspect-[1.91/1] place-items-center bg-cream text-xs text-ink-soft">Standaardafbeelding van de site</div>
          )}
          <div className="p-3">
            <p className="text-[0.7rem] uppercase text-[#65676b]">bluepuremarine.com</p>
            <p className="line-clamp-1 text-sm font-semibold text-[#050505]">{v.title}</p>
            <p className="line-clamp-1 text-xs text-[#65676b]">{v.desc}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Mediakiezer: zoeken in de bibliotheek of direct uploaden. */
export function MediaPicker({ onPick, onClose, multiple }: { onPick: (m: Media[]) => void; onClose: () => void; multiple?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Media[]>([]);
  const [sel, setSel] = useState<Media[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => dialog.current?.showModal(), []);
  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/admin/media/?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d: { items: Media[] }) => setItems(d.items ?? []));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    const fd = new FormData();
    for (const f of Array.from(files)) fd.append("file", f);
    const res = await fetch("/api/admin/upload/", { method: "POST", body: fd });
    const data = (await res.json()) as { items?: Media[]; error?: string };
    setUploading(false);
    if (data.items) {
      setItems((cur) => [...data.items!, ...cur]);
      setSel((s) => (multiple ? [...data.items!, ...s] : data.items!.slice(0, 1)));
    } else setError(data.error ?? "Upload mislukt");
  };
  return (
    <dialog ref={dialog} onClose={onClose} className="m-auto h-[85dvh] w-[min(1000px,95vw)] rounded-2xl p-0 backdrop:bg-ink/60">
      <div className="flex h-full flex-col">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Zoek op naam of alt-tekst" className={`${input} max-w-xs`} type="search" aria-label="Zoek in media" />
          <label className={`${btnSm} cursor-pointer`}>
            <Icon name="upload" className="h-3.5 w-3.5" /> {uploading ? "Uploaden…" : "Uploaden"}
            <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => upload(e.target.files)} />
          </label>
          {error && <span className="text-xs text-danger">{error}</span>}
          <button type="button" onClick={() => dialog.current?.close()} className="ml-auto rounded-full p-2 hover:bg-cream" aria-label="Sluiten">
            <Icon name="close" />
          </button>
        </div>
        <div className="grid flex-1 grid-cols-3 content-start gap-3 overflow-y-auto p-4 sm:grid-cols-5 lg:grid-cols-6">
          {items.map((m) => {
            const on = sel.some((s) => s.id === m.id);
            return (
              <button key={m.id} type="button" onClick={() => setSel(multiple ? (on ? sel.filter((s) => s.id !== m.id) : [...sel, m]) : [m])} className={`relative aspect-square overflow-hidden rounded-xl border-2 ${on ? "border-lilac-700 ring-2 ring-lilac" : "border-transparent"}`} title={m.alt || m.path}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.path} alt={m.alt} loading="lazy" className="h-full w-full object-cover" />
                {on && <Icon name="check" className="absolute right-1 top-1 h-6 w-6 rounded-full bg-lilac-700 p-1 text-white" />}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between border-t border-line p-4">
          <span className="text-sm text-ink-soft">{sel.length} geselecteerd</span>
          <button
            type="button"
            className={btn}
            disabled={!sel.length}
            onClick={() => {
              onPick(sel);
              dialog.current?.close();
            }}
          >
            Gebruiken
          </button>
        </div>
      </div>
    </dialog>
  );
}

/** Eén afbeelding (uitgelicht beeld) met alt-tekst. */
export function ImageField({ name, altName, value, alt, label = "Uitgelichte afbeelding" }: { name: string; altName?: string; value?: string | null; alt?: string | null; label?: string }) {
  const [src, setSrc] = useState(value ?? "");
  const [altText, setAlt] = useState(alt ?? "");
  const [open, setOpen] = useState(false);
  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-ink-soft">{label}</span>
      <input type="hidden" name={name} value={src} />
      <div className="flex items-start gap-4">
        <button type="button" onClick={() => setOpen(true)} className="grid h-28 w-24 shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-line bg-cream text-xs text-ink-soft">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : "Kies beeld"}
        </button>
        <div className="flex-1 space-y-2">
          {altName && <input name={altName} value={altText} onChange={(e) => setAlt(e.target.value)} placeholder="Alt-tekst: beschrijf wat er te zien is" className={input} aria-label="Alt-tekst" />}
          <div className="flex gap-2">
            <button type="button" className={btnSm} onClick={() => setOpen(true)}>
              {src ? "Wijzigen" : "Kiezen"}
            </button>
            {src && (
              <button type="button" className={btnDanger} onClick={() => setSrc("")}>
                Verwijderen
              </button>
            )}
          </div>
        </div>
      </div>
      {open && (
        <MediaPicker
          onClose={() => setOpen(false)}
          onPick={([m]) => {
            setSrc(m.path);
            if (!altText) setAlt(m.alt);
          }}
        />
      )}
    </div>
  );
}

/** Productgalerij: volgorde wijzigen, alt-teksten, toevoegen uit de bibliotheek. */
export function ImageListEditor({ name, value }: { name: string; value: { src: string; alt: string }[] }) {
  const [list, setList] = useState(value);
  const [open, setOpen] = useState(false);
  const move = (i: number, d: number) => {
    const n = [...list];
    const [x] = n.splice(i, 1);
    n.splice(Math.max(0, Math.min(n.length, i + d)), 0, x);
    setList(n);
  };
  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(list)} />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {list.map((img, i) => (
          <li key={img.src + i} className="rounded-xl border border-line p-2">
            <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-cream">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.src} alt="" className="h-full w-full object-cover" />
              {i === 0 && <span className="absolute left-1 top-1 rounded-full bg-navy px-2 py-0.5 text-[0.65rem] text-white">Hoofdfoto</span>}
            </div>
            <input value={img.alt} onChange={(e) => setList(list.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))} placeholder="Alt-tekst" className={`${input} mt-2 !text-xs`} aria-label={`Alt-tekst foto ${i + 1}`} />
            <div className="mt-2 flex justify-between gap-1">
              <button type="button" className={btnSm} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Naar voren">
                ←
              </button>
              <button type="button" className={btnSm} onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label="Naar achteren">
                →
              </button>
              <button type="button" className={btnDanger} onClick={() => setList(list.filter((_, j) => j !== i))} aria-label="Verwijderen">
                ✕
              </button>
            </div>
          </li>
        ))}
        <li>
          <button type="button" onClick={() => setOpen(true)} className="grid aspect-[3/4] w-full place-items-center rounded-xl border-2 border-dashed border-line text-sm text-ink-soft hover:border-ink">
            + Foto&apos;s toevoegen
          </button>
        </li>
      </ul>
      {open && <MediaPicker multiple onClose={() => setOpen(false)} onPick={(ms) => setList([...list, ...ms.map((m) => ({ src: m.path, alt: m.alt }))])} />}
    </div>
  );
}

/** Rich-text-editor: koppen, opmaak, lijsten, links, citaat en afbeeldingen. HTML wordt op de server opgeschoond. */
export function RichText({ name, value, minHeight = 320 }: { name: string; value: string; minHeight?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState(value);
  const [source, setSource] = useState(false);
  const [picker, setPicker] = useState(false);
  const savedRange = useRef<Range | null>(null);
  useEffect(() => {
    if (ref.current && !source) ref.current.innerHTML = html;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);
  const sync = () => {
    if (ref.current) setHtml(ref.current.innerHTML);
    ref.current?.closest("form")?.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const cmd = (c: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(c, false, arg);
    sync();
  };
  const saveRange = () => {
    const s = window.getSelection();
    if (s && s.rangeCount) savedRange.current = s.getRangeAt(0);
  };
  const insert = (h: string) => cmd("insertHTML", h);
  const tools: ([string, string, () => void] | "|")[] = [
    ["H2", "Kop 2", () => cmd("formatBlock", "h2")],
    ["H3", "Kop 3", () => cmd("formatBlock", "h3")],
    ["H4", "Kop 4", () => cmd("formatBlock", "h4")],
    ["¶", "Alinea", () => cmd("formatBlock", "p")],
    "|",
    ["B", "Vet", () => cmd("bold")],
    ["I", "Cursief", () => cmd("italic")],
    ["U", "Onderstrepen", () => cmd("underline")],
    ["x²", "Superscript", () => cmd("superscript")],
    ["⌫ opmaak", "Opmaak wissen", () => cmd("removeFormat")],
    "|",
    ["• Lijst", "Opsomming", () => cmd("insertUnorderedList")],
    ["1. Lijst", "Genummerde lijst", () => cmd("insertOrderedList")],
    ["❝", "Citaat", () => cmd("formatBlock", "blockquote")],
    ["―", "Scheidingslijn", () => insert("<hr><p><br></p>")],
    "|",
    [
      "Link",
      "Link toevoegen",
      () => {
        const url = window.prompt("Link (bijv. /onderhoud/ of https://…)");
        if (url) cmd("createLink", url.trim());
      },
    ],
    ["Unlink", "Link verwijderen", () => cmd("unlink")],
    [
      "Beeld",
      "Afbeelding invoegen",
      () => {
        saveRange();
        setPicker(true);
      },
    ],
    [
      "Video",
      "YouTube-video invoegen",
      () => {
        const url = window.prompt("YouTube-link (bijv. https://www.youtube.com/watch?v=…)");
        const id = url && /(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/.exec(url)?.[1];
        if (id) insert(`<iframe src="https://www.youtube-nocookie.com/embed/${id}" title="Video" allowfullscreen></iframe><p><br></p>`);
        else if (url) window.alert("Dat lijkt geen YouTube-link.");
      },
    ],
    [
      "Tabel",
      "Tabel invoegen",
      () => {
        const n = Math.min(8, Math.max(2, Number(window.prompt("Aantal kolommen?", "2")) || 2));
        const cells = (tag: string) => `<tr>${Array.from({ length: n }, () => `<${tag}>${tag === "th" ? "Kop" : "&nbsp;"}</${tag}>`).join("")}</tr>`;
        insert(`<table><thead>${cells("th")}</thead><tbody>${cells("td")}${cells("td")}</tbody></table><p><br></p>`);
      },
    ],
    ["FAQ", "Uitklapvraag (FAQ) invoegen", () => insert("<details><summary>Vraag?</summary><p>Antwoord.</p></details><p><br></p>")],
    "|",
    ["↶", "Ongedaan maken", () => cmd("undo")],
    ["↷", "Opnieuw", () => cmd("redo")],
  ];
  // Plakken uit Word/Google Docs/websites: alleen inhoud, geen kleuren, lettertypes of stijlen
  const onPaste = (e: React.ClipboardEvent) => {
    const htmlData = e.clipboardData.getData("text/html");
    if (!htmlData) return;
    e.preventDefault();
    const doc = new DOMParser().parseFromString(htmlData, "text/html");
    doc.querySelectorAll("script,style,meta,link,o\\:p").forEach((n) => n.remove());
    doc.body.querySelectorAll("*").forEach((n) => {
      for (const a of Array.from(n.attributes)) if (!["href", "src", "alt"].includes(a.name)) n.removeAttribute(a.name);
    });
    doc.body.querySelectorAll("span,font").forEach((n) => n.replaceWith(...Array.from(n.childNodes)));
    document.execCommand("insertHTML", false, doc.body.innerHTML);
    sync();
  };
  const [full, setFull] = useState(false);
  const words = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  return (
    <div className={`flex flex-col rounded-xl border border-line bg-white focus-within:border-lilac-700 ${full ? "fixed inset-3 z-[70] shadow-2xl" : ""}`}>
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 rounded-t-xl border-b border-line bg-white p-2" role="toolbar" aria-label="Opmaak">
        {tools.map((t, i) =>
          t === "|" ? (
            <span key={i} className="mx-1 h-5 w-px bg-line" aria-hidden="true" />
          ) : (
            <button key={t[1]} type="button" title={t[1]} aria-label={t[1]} onMouseDown={(e) => e.preventDefault()} onClick={t[2]} disabled={source} className="rounded-md px-2.5 py-1 text-xs font-medium hover:bg-cream disabled:opacity-40">
              {t[0]}
            </button>
          ),
        )}
        <span className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => setSource(!source)} className="rounded-md px-2.5 py-1 text-xs font-medium hover:bg-cream">
            {source ? "Visueel" : "HTML"}
          </button>
          <button type="button" onClick={() => setFull(!full)} className="rounded-md px-2.5 py-1 text-xs font-medium hover:bg-cream" aria-pressed={full}>
            {full ? "Verkleinen" : "Volledig scherm"}
          </button>
        </span>
      </div>
      {source ? (
        <textarea value={html} onChange={(e) => setHtml(e.target.value)} className="block w-full flex-1 p-4 font-mono text-xs outline-none" style={{ minHeight }} aria-label="HTML-bron" />
      ) : (
        <div ref={ref} contentEditable suppressContentEditableWarning onInput={sync} onBlur={sync} onPaste={onPaste} className={`prose-bp max-w-none flex-1 p-4 outline-none overflow-y-auto ${full ? "" : "max-h-[70vh]"}`} style={{ minHeight }} role="textbox" aria-multiline="true" aria-label="Tekst" />
      )}
      <p className="border-t border-line px-4 py-1.5 text-right text-[0.7rem] text-ink-soft">{words} woorden · ca. {Math.max(1, Math.round(words / 220))} min. leestijd</p>
      <input type="hidden" name={name} value={html} />
      {picker && (
        <MediaPicker
          onClose={() => setPicker(false)}
          onPick={([m]) => {
            ref.current?.focus();
            const s = window.getSelection();
            if (savedRange.current && s) {
              s.removeAllRanges();
              s.addRange(savedRange.current);
            }
            document.execCommand("insertHTML", false, `<img src="${m.path}" alt="${m.alt.replace(/"/g, "&quot;")}">`);
            sync();
          }}
        />
      )}
    </div>
  );
}

/** Verwijderknop met bevestiging. */
export function DeleteButton({ action, label = "Verwijderen", confirmText = "Weet je zeker dat je dit wilt verwijderen? Dit kan niet ongedaan worden gemaakt." }: { action: () => Promise<void>; label?: string; confirmText?: string }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    >
      <button className={`${btnDanger} w-full justify-center`}>{label}</button>
    </form>
  );
}
