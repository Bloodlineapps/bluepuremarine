import Link from "next/link";
import { deleteMedia, updateMediaAlt } from "@/app/admin/actions/manage";
import { DeleteButton } from "@/components/admin/fields";
import { MediaUpload } from "@/components/admin/MediaUpload";
import { SimpleForm } from "@/components/admin/SimpleForm";
import { Notice, PageHeader, Panel, btn, input } from "@/components/admin/ui";
import { mediaUsage } from "@/lib/admin/media-usage";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { like } from "@/lib/search";

export const metadata = { title: "Media" };
const PER = 48;

export default async function MediaAdmin({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireUser();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.pagina) || 1);
  const where = { ...(q ? { OR: [{ path: like(q) }, { alt: like(q) }] } : {}), ...(sp.alt === "leeg" ? { alt: "" } : {}), ...(sp.map ? { folder: sp.map } : {}) };
  const [items, total, missingAlt, folders] = await Promise.all([db.media.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER, take: PER }), db.media.count({ where }), db.media.count({ where: { alt: "" } }), db.media.groupBy({ by: ["folder"], _count: true, orderBy: { folder: "asc" } })]);
  const sel = sp.id ? await db.media.findUnique({ where: { id: sp.id } }) : null;
  // waar wordt het geselecteerde bestand gebruikt? (pagina's, FAQ, producten, categorieën, merken, blogs, homepage)
  const usedIn = sel ? await mediaUsage(sel.path) : [];
  const pages = Math.ceil(total / PER);
  const qs = (n: number) => `/admin/media/?${new URLSearchParams({ ...(q ? { q } : {}), ...(sp.alt ? { alt: sp.alt } : {}), ...(sp.map ? { map: sp.map } : {}), pagina: String(n) })}`;
  return (
    <>
      <PageHeader title="Media" description="Sleep afbeeldingen naar het uploadvak: ze worden automatisch verkleind, omgezet naar WebP en krijgen een alt-tekst. Orden ze in mappen en zie per bestand waar het gebruikt wordt." />
      {sp.verwijderd && <Notice>Afbeelding verwijderd.</Notice>}
      {sp.inGebruik && <Notice tone="danger">Deze afbeelding wordt nog gebruikt op de site en is niet verwijderd. Haal hem eerst weg op de plekken die bij “Gebruikt op” staan.</Notice>}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-line bg-white">
          <form className="flex flex-wrap items-center gap-3 border-b border-line p-4" action="/admin/media/">
            <input name="q" defaultValue={q} placeholder="Zoek op bestandsnaam of alt-tekst" className={`${input} max-w-xs`} type="search" aria-label="Zoek media" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="alt" value="leeg" defaultChecked={sp.alt === "leeg"} /> Zonder alt-tekst ({missingAlt})
            </label>
            <select name="map" defaultValue={sp.map ?? ""} className={`${input} !w-auto`} aria-label="Map">
              <option value="">Alle mappen</option>
              {folders.map((f) => (
                <option key={f.folder} value={f.folder}>
                  {f.folder || "Zonder map"} ({f._count})
                </option>
              ))}
            </select>
            <button className={btn}>Filter</button>
            <span className="ml-auto text-sm text-ink-soft">{total} afbeeldingen</span>
          </form>
          <ul className="grid grid-cols-3 gap-3 p-4 sm:grid-cols-5 xl:grid-cols-6">
            {items.map((m) => (
              <li key={m.id}>
                <Link href={`/admin/media/?${new URLSearchParams({ ...(q ? { q } : {}), ...(sp.alt ? { alt: sp.alt } : {}), ...(sp.map ? { map: sp.map } : {}), pagina: String(page), id: m.id })}`} className={`block aspect-square overflow-hidden rounded-xl border-2 ${sel?.id === m.id ? "border-lilac-700" : "border-transparent"}`} title={m.alt || m.path}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.path} alt={m.alt} loading="lazy" className="h-full w-full object-cover" />
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-line p-4 text-sm">
            <span className="text-ink-soft">
              Pagina {page} van {Math.max(1, pages)}
            </span>
            <div className="flex gap-2">
              {page > 1 && <Link href={qs(page - 1)} className="rounded-full border border-line px-3 py-1">Vorige</Link>}
              {page < pages && <Link href={qs(page + 1)} className="rounded-full border border-line px-3 py-1">Volgende</Link>}
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <Panel title="Uploaden">
            <MediaUpload />
          </Panel>
          {sel && (
            <Panel title="Details">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sel.path} alt={sel.alt} className="mb-3 w-full rounded-xl" />
              <p className="break-all font-mono text-xs">{sel.path}</p>
              <p className="mb-3 text-xs text-ink-soft">
                {sel.width}×{sel.height}px · {sel.size ? Math.round(sel.size / 1024) : "?"} kB
              </p>
              <SimpleForm action={updateMediaAlt.bind(null, sel.id)} key={sel.id}>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-ink-soft">Alt-tekst</span>
                  <textarea name="alt" defaultValue={sel.alt} rows={3} className={input} />
                </label>
                <label className="mt-3 block">
                  <span className="mb-1.5 block text-xs font-medium text-ink-soft">Map</span>
                  <input name="folder" defaultValue={sel.folder} list="media-folders" className={input} />
                  <datalist id="media-folders">
                    {folders.map((f) => (
                      <option key={f.folder} value={f.folder} />
                    ))}
                  </datalist>
                </label>
              </SimpleForm>
              <div className="mt-4 text-sm">
                <p className="text-xs font-medium text-ink-soft">Gebruikt op</p>
                {usedIn.length > 0 ? (
                  <ul className="mt-1 space-y-1">
                    {usedIn.map((u, i) => (
                      <li key={i}>
                        <Link href={u.href} className="underline">
                          {u.label}
                        </Link>{" "}
                        {u.detail && <span className="font-mono text-xs text-ink-soft">{u.detail}</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-ink-soft">Nergens: het bestand kan veilig worden verwijderd.</p>
                )}
              </div>
              <div className="mt-4">
                <DeleteButton action={deleteMedia.bind(null, sel.id)} label="Afbeelding verwijderen" confirmText="Deze afbeelding definitief verwijderen? Dat lukt alleen als hij nergens meer gebruikt wordt." />
              </div>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
