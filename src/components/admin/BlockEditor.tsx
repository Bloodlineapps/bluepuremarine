"use client";
import { useState } from "react";
import { BLOCK_LABELS, LAYOUT_LABELS, emptyBlock, type Block, type BlockType, type SectionLayout } from "@/lib/blocks";
import { ImageField, MediaPicker, RichText } from "./fields";
import { Field, btnDanger, btnSm, input } from "./ui";

// Blokken-editor voor pagina's: blokken toevoegen, verslepen (of met de pijltjes verplaatsen), bewerken en
// verwijderen. De structuur gaat als JSON mee in het verborgen veld "blocks"; de rich-text van elk blok staat in
// een eigen veld (b_<id>_<veld>) en wordt op de server opgeschoond.

type Opt = { value: string; label: string };

export function BlockEditor({ initial, forms, pages }: { initial: Block[]; forms: Opt[]; pages: Opt[] }) {
  // kaarten krijgen een vaste sleutel (_k), zodat hun tekstveld meeverhuist bij het verplaatsen
  const [blocks, setBlocks] = useState<Block[]>(() => initial.map((b) => (b.type === "cards" ? { ...b, items: b.items.map((i) => ({ ...i, _k: (i as { _k?: string })._k ?? Math.random().toString(36).slice(2, 8) })) } : b)));
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [add, setAdd] = useState<BlockType>("section");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const update = (i: number, b: Block) => setBlocks(blocks.map((x, j) => (j === i ? b : x)));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= blocks.length || from === to) return;
    const n = [...blocks];
    const [x] = n.splice(from, 1);
    n.splice(to, 0, x);
    setBlocks(n);
  };
  const changed = () => document.querySelector("form")?.dispatchEvent(new Event("change", { bubbles: true }));

  // Rich-text-velden staan in het formulier; bij verplaatsen moeten we die waarde meenemen, dus de structuur
  // (zonder html) in JSON en de html via de eigen velden.
  const structure = blocks.map((b) => ({ ...b }));

  return (
    <div>
      <input type="hidden" name="blocks" value={JSON.stringify(structure)} />
      <ol className="space-y-3">
        {blocks.map((b, i) => {
          const isOpen = open[b.id] ?? blocks.length <= 3;
          return (
            <li
              key={b.id}
              onDragOver={(e) => {
                if (drag === null) return;
                e.preventDefault();
                setOver(i);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (drag !== null) move(drag, i);
                setDrag(null);
                setOver(null);
                changed();
              }}
              className={`rounded-xl border bg-white ${over === i && drag !== null && drag !== i ? "border-lilac-700 ring-2 ring-lilac" : "border-line"}`}
            >
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
                <span
                  draggable
                  onDragStart={() => setDrag(i)}
                  onDragEnd={() => {
                    setDrag(null);
                    setOver(null);
                  }}
                  className="cursor-grab select-none px-1 text-ink-soft"
                  title="Sleep om te verplaatsen"
                  aria-hidden="true"
                >
                  ⠿
                </span>
                <span className="rounded bg-cream px-2 py-0.5 text-xs font-semibold">{BLOCK_LABELS[b.type].label}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">{summaryOf(b)}</span>
                <button type="button" className={btnSm} onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Blok ${i + 1} omhoog`}>
                  ↑
                </button>
                <button type="button" className={btnSm} onClick={() => move(i, i + 1)} disabled={i === blocks.length - 1} aria-label={`Blok ${i + 1} omlaag`}>
                  ↓
                </button>
                <button type="button" className={btnSm} onClick={() => setOpen({ ...open, [b.id]: !isOpen })} aria-expanded={isOpen}>
                  {isOpen ? "Inklappen" : "Bewerken"}
                </button>
                <button
                  type="button"
                  className={btnDanger}
                  onClick={() => {
                    if (window.confirm(`Blok "${BLOCK_LABELS[b.type].label}" verwijderen? Dit wordt definitief bij opslaan.`)) {
                      setBlocks(blocks.filter((_, j) => j !== i));
                      changed();
                    }
                  }}
                >
                  Verwijderen
                </button>
              </div>
              {/* velden blijven in het formulier staan als het blok is ingeklapt */}
              <div className={isOpen ? "space-y-3 p-4" : "hidden"}>
                <BlockFields b={b} onChange={(nb) => update(i, nb)} forms={forms} pages={pages} />
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-line p-3">
        <Field label="Blok toevoegen" className="min-w-56 flex-1">
          <select value={add} onChange={(e) => setAdd(e.target.value as BlockType)} className={input}>
            {(Object.keys(BLOCK_LABELS) as BlockType[]).map((t) => (
              <option key={t} value={t}>
                {BLOCK_LABELS[t].label}: {BLOCK_LABELS[t].help}
              </option>
            ))}
          </select>
        </Field>
        <button
          type="button"
          className={btnSm}
          onClick={() => {
            const nb = emptyBlock(add);
            // nieuwe afsluitende oproep altijd onderaan, andere blokken vóór de afsluiter
            const lastIsCta = blocks.at(-1)?.type === "cta";
            const at = add !== "cta" && lastIsCta ? blocks.length - 1 : blocks.length;
            setBlocks([...blocks.slice(0, at), nb, ...blocks.slice(at)]);
            setOpen({ ...open, [nb.id]: true });
            changed();
          }}
        >
          + Toevoegen
        </button>
      </div>
    </div>
  );
}

const plain = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
function summaryOf(b: Block) {
  switch (b.type) {
    case "section":
      return `${b.heading || plain(b.html).slice(0, 60)} (${LAYOUT_LABELS[b.layout]})`;
    case "text":
    case "cta":
      return plain(b.html).slice(0, 80);
    case "cards":
      return `${b.items.length} kaarten: ${b.items.map((i) => i.title).join(", ")}`;
    case "logos":
      return `${b.items.length} logo's`;
    case "buttons":
      return b.items.map((i) => i.label).join(" / ");
    case "image":
      return b.alt || b.src;
    case "form":
      return `Formulier "${b.formKey}"`;
    default:
      return "";
  }
}

function BlockFields({ b, onChange, forms, pages }: { b: Block; onChange: (b: Block) => void; forms: Opt[]; pages: Opt[] }) {
  const [picker, setPicker] = useState(false);
  switch (b.type) {
    case "section":
      return (
        <>
          <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
            <Field label="Kop (H2)">
              <input value={b.heading} onChange={(e) => onChange({ ...b, heading: e.target.value })} className={input} />
            </Field>
            <Field label="Opmaak">
              <select value={b.layout} onChange={(e) => onChange({ ...b, layout: e.target.value as SectionLayout })} className={input}>
                {Object.entries(LAYOUT_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {b.layout === "image" && <SectionImage b={b} onChange={onChange} />}
          <RichText name={`b_${b.id}_html`} value={b.html} minHeight={140} />
        </>
      );
    case "text":
      return <RichText name={`b_${b.id}_html`} value={b.html} minHeight={160} />;
    case "faq":
      return (
        <>
          <Field label="Kop (leeg = Veelgestelde vragen)">
            <input value={b.heading} onChange={(e) => onChange({ ...b, heading: e.target.value })} className={input} />
          </Field>
          <p className="text-xs text-ink-soft">De vragen zelf beheer je onder Veelgestelde vragen (met volgorde).</p>
          <RichText name={`b_${b.id}_html`} value={b.html} minHeight={80} />
        </>
      );
    case "cta":
      return (
        <>
          <span className="block text-xs font-medium text-ink-soft">Zin boven de knop (wordt de kop van de afsluiter)</span>
          <RichText name={`b_${b.id}_html`} value={b.html} minHeight={70} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Knoptekst">
              <input value={b.label} onChange={(e) => onChange({ ...b, label: e.target.value })} className={input} />
            </Field>
            <Field label="Link">
              <LinkInput value={b.href} onChange={(href) => onChange({ ...b, href })} pages={pages} />
            </Field>
          </div>
        </>
      );
    case "form":
      return (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Kop">
              <input value={b.heading} onChange={(e) => onChange({ ...b, heading: e.target.value })} className={input} />
            </Field>
            <Field label="Formulier">
              <select value={b.formKey} onChange={(e) => onChange({ ...b, formKey: e.target.value })} className={input}>
                {forms.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <span className="block text-xs font-medium text-ink-soft">Tekst naast het formulier</span>
          <RichText name={`b_${b.id}_html`} value={b.html} minHeight={70} />
          <span className="block text-xs font-medium text-ink-soft">Kleine tekst onder het formulier (privacy)</span>
          <RichText name={`b_${b.id}_note`} value={b.note ?? ""} minHeight={60} />
        </>
      );
    case "buttons":
      return (
        <div className="space-y-2">
          {b.items.map((it, n) => (
            <div key={n} className="grid gap-2 sm:grid-cols-[1fr_1fr_140px_auto]">
              <input value={it.label} placeholder="Knoptekst" onChange={(e) => onChange({ ...b, items: b.items.map((x, j) => (j === n ? { ...x, label: e.target.value } : x)) })} className={input} aria-label="Knoptekst" />
              <LinkInput value={it.href} onChange={(href) => onChange({ ...b, items: b.items.map((x, j) => (j === n ? { ...x, href } : x)) })} pages={pages} />
              <select value={it.style} onChange={(e) => onChange({ ...b, items: b.items.map((x, j) => (j === n ? { ...x, style: e.target.value as "primary" | "secondary" } : x)) })} className={input} aria-label="Stijl">
                <option value="primary">Primair</option>
                <option value="secondary">Secundair</option>
              </select>
              <button type="button" className={btnDanger} onClick={() => onChange({ ...b, items: b.items.filter((_, j) => j !== n) })}>
                ✕
              </button>
            </div>
          ))}
          {b.items.length < 2 && (
            <button type="button" className={btnSm} onClick={() => onChange({ ...b, items: [...b.items, { label: "", href: "", style: "secondary" }] })}>
              + Knop
            </button>
          )}
        </div>
      );
    case "image":
      return (
        <>
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {b.src ? <img src={b.src} alt="" className="h-24 w-36 rounded object-cover" /> : <span className="grid h-24 w-36 place-items-center rounded bg-cream text-xs text-ink-soft">Geen beeld</span>}
            <button type="button" className={btnSm} onClick={() => setPicker(true)}>
              Kies uit media
            </button>
          </div>
          <Field label="Alt-tekst (verplicht: beschrijf wat er te zien is)">
            <input value={b.alt} onChange={(e) => onChange({ ...b, alt: e.target.value })} className={input} />
          </Field>
          <Field label="Bijschrift">
            <input value={b.caption ?? ""} onChange={(e) => onChange({ ...b, caption: e.target.value })} className={input} />
          </Field>
          {picker && <MediaPicker onClose={() => setPicker(false)} onPick={([m]) => onChange({ ...b, src: m.path, alt: b.alt || m.alt })} />}
        </>
      );
    case "cards":
      return (
        <div className="space-y-3">
          <Field label="Kop boven de kaarten (optioneel)">
            <input value={b.heading} onChange={(e) => onChange({ ...b, heading: e.target.value })} className={input} />
          </Field>
          {b.items.map((it, n) => (
            <div key={(it as { _k?: string })._k ?? n} className="space-y-2 rounded-lg border border-line p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto_auto]">
                <input value={it.title} placeholder="Titel" onChange={(e) => onChange({ ...b, items: b.items.map((x, j) => (j === n ? { ...x, title: e.target.value } : x)) })} className={input} aria-label="Titel" />
                <LinkInput value={it.href} onChange={(href) => onChange({ ...b, items: b.items.map((x, j) => (j === n ? { ...x, href, key: null } : x)) })} pages={pages} />
                <button type="button" className={btnSm} disabled={n === 0} onClick={() => onChange({ ...b, items: swap(b.items, n, n - 1) })} aria-label="Kaart omhoog">
                  ↑
                </button>
                <button type="button" className={btnSm} disabled={n === b.items.length - 1} onClick={() => onChange({ ...b, items: swap(b.items, n, n + 1) })} aria-label="Kaart omlaag">
                  ↓
                </button>
                <button type="button" className={btnDanger} onClick={() => onChange({ ...b, items: b.items.filter((_, j) => j !== n) })}>
                  ✕
                </button>
              </div>
              <RichText name={`b_${b.id}_card_${(it as { _k?: string })._k}`} value={it.html} minHeight={90} />
            </div>
          ))}
          <button type="button" className={btnSm} onClick={() => onChange({ ...b, items: [...b.items, { title: "", html: "", href: "", _k: Math.random().toString(36).slice(2, 8) } as (typeof b.items)[number]] })}>
            + Kaart
          </button>
        </div>
      );
    case "children":
      return (
        <Field label="Kop (optioneel)" hint="Toont automatisch de gepubliceerde pagina's die deze pagina als bovenliggende pagina hebben.">
          <input value={b.heading} onChange={(e) => onChange({ ...b, heading: e.target.value })} className={input} />
        </Field>
      );
    case "logos":
      return (
        <div className="space-y-2">
          <Field label="Bijschrift onder de logo's">
            <input value={b.heading} onChange={(e) => onChange({ ...b, heading: e.target.value })} className={input} />
          </Field>
          {b.items.map((it, n) => (
            <div key={n} className="grid items-center gap-2 sm:grid-cols-[64px_1fr_1fr_auto]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.src} alt="" className="h-10 w-16 object-contain" />
              <input value={it.alt} placeholder="Naam (alt-tekst)" onChange={(e) => onChange({ ...b, items: b.items.map((x, j) => (j === n ? { ...x, alt: e.target.value } : x)) })} className={input} aria-label="Alt-tekst" />
              <input value={it.href ?? ""} placeholder="https://…" onChange={(e) => onChange({ ...b, items: b.items.map((x, j) => (j === n ? { ...x, href: e.target.value } : x)) })} className={input} aria-label="Link" />
              <button type="button" className={btnDanger} onClick={() => onChange({ ...b, items: b.items.filter((_, j) => j !== n) })}>
                ✕
              </button>
            </div>
          ))}
          <button type="button" className={btnSm} onClick={() => setPicker(true)}>
            + Logo uit media
          </button>
          {picker && <MediaPicker multiple onClose={() => setPicker(false)} onPick={(ms) => onChange({ ...b, items: [...b.items, ...ms.map((m) => ({ src: m.path, alt: m.alt, href: null }))] })} />}
        </div>
      );
  }
}

function SectionImage({ b, onChange }: { b: Extract<Block, { type: "section" }>; onChange: (b: Block) => void }) {
  const [picker, setPicker] = useState(false);
  return (
    <div className="flex flex-wrap items-start gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {b.image ? <img src={b.image} alt="" className="h-20 w-28 rounded object-cover" /> : <span className="grid h-20 w-28 place-items-center rounded bg-cream text-xs text-ink-soft">Geen foto</span>}
      <div className="flex-1 space-y-2">
        <button type="button" className={btnSm} onClick={() => setPicker(true)}>
          Kies foto
        </button>
        <input value={b.imageAlt ?? ""} onChange={(e) => onChange({ ...b, imageAlt: e.target.value })} placeholder="Alt-tekst" className={input} aria-label="Alt-tekst foto" />
      </div>
      {picker && <MediaPicker onClose={() => setPicker(false)} onPick={([m]) => onChange({ ...b, image: m.path, imageAlt: b.imageAlt || m.alt })} />}
    </div>
  );
}

/** Linkveld met suggesties: pagina's en categorieën, of een vrije URL. */
function LinkInput({ value, onChange, pages }: { value: string; onChange: (v: string) => void; pages: Opt[] }) {
  const id = "pages-datalist";
  return (
    <>
      <input value={value} onChange={(e) => onChange(e.target.value)} list={id} placeholder="/contact/ of https://…" className={`${input} font-mono`} aria-label="Link" />
      <datalist id={id}>
        {pages.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </datalist>
    </>
  );
}

const swap = <T,>(a: T[], i: number, j: number) => {
  const n = [...a];
  [n[i], n[j]] = [n[j], n[i]];
  return n;
};

export { ImageField };
