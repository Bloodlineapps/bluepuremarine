import Link from "next/link";
import { bulkTrash, destroyFromTrash, restoreFromTrash } from "@/app/admin/actions/content";
import { BulkBar } from "@/components/admin/BulkBar";
import { DeleteButton } from "@/components/admin/fields";
import { ActionForm } from "@/components/admin/SimpleForm";
import { Badge, Notice, PageHeader, btn, fmtDateTime, input } from "@/components/admin/ui";
import { ENTITY_LABEL } from "@/lib/admin/revisions";
import { KEEP_DAYS, TRASH_TYPES, daysLeft, purgeExpired, trashItems } from "@/lib/admin/trash";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Prullenbak" };

export default async function Trash({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireUser();
  const sp = await searchParams;
  const purged = await purgeExpired();
  const all = await trashItems();
  const q = (sp.q ?? "").trim().toLowerCase();
  const items = all
    .filter((i) => !sp.type || i.type === sp.type)
    .filter((i) => !q || i.title.toLowerCase().includes(q) || i.detail.toLowerCase().includes(q))
    .sort((a, b) => (sp.sorteer === "verloopt" ? a.deletedAt.getTime() - b.deletedAt.getTime() : sp.sorteer === "naam" ? a.title.localeCompare(b.title, "nl") : b.deletedAt.getTime() - a.deletedAt.getTime()));
  return (
    <>
      <PageHeader title="Prullenbak" description={`Verwijderde pagina's, producten, categorieën, blogs, veelgestelde vragen en formulieren blijven ${Math.round(KEEP_DAYS / 30)} maanden bewaard en worden daarna automatisch definitief verwijderd.`} />
      {purged > 0 && <Notice>{purged} verlopen items zijn zojuist definitief verwijderd.</Notice>}
      {sp.hersteld && <Notice>Het item is hersteld en staat weer in het overzicht.</Notice>}
      {sp.definitief && <Notice>Het item is definitief verwijderd.</Notice>}
      {all.length > 0 && (
        <BulkBar
          formId="bulk-trash"
          action={bulkTrash}
          allIds={[]}
          options={[
            { value: "restore", label: "Herstellen", confirm: "{n} items herstellen?" },
            { value: "destroy", label: "Definitief verwijderen", confirm: "{n} items definitief verwijderen? Dit kan niet ongedaan worden gemaakt; ook de revisies verdwijnen." },
          ]}
        />
      )}
      <div className="rounded-2xl border border-line bg-white">
        <form action="/admin/prullenbak/" className="flex flex-wrap items-end gap-3 border-b border-line p-4" role="search">
          <input name="q" defaultValue={sp.q} placeholder="Zoek op naam of URL" type="search" className={`${input} min-w-[180px] flex-1`} aria-label="Zoeken" />
          <select name="type" defaultValue={sp.type ?? ""} className={`${input} !w-auto`} aria-label="Type">
            <option value="">Type: alle</option>
            {TRASH_TYPES.map((t) => (
              <option key={t} value={t}>
                {ENTITY_LABEL[t]} ({all.filter((i) => i.type === t).length})
              </option>
            ))}
          </select>
          <select name="sorteer" defaultValue={sp.sorteer ?? ""} className={`${input} !w-auto`} aria-label="Sorteren">
            <option value="">Sorteer: laatst verwijderd</option>
            <option value="verloopt">Sorteer: verloopt het eerst</option>
            <option value="naam">Sorteer: naam</option>
          </select>
          <button className={btn}>Filter</button>
          {(sp.q || sp.type) && (
            <Link href="/admin/prullenbak/" className="text-sm underline">
              Wissen
            </Link>
          )}
        </form>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-ink-soft">
              <tr>
                <th className="w-10 px-4 py-3">
                  <span className="sr-only">Selecteren</span>
                </th>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Verwijderd op</th>
                <th className="px-4 py-3 font-medium">Nog bewaard</th>
                <th className="px-4 py-3 font-medium">Actie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((i) => {
                const left = daysLeft(i.deletedAt);
                return (
                  <tr key={`${i.type}:${i.id}`} className="hover:bg-cream/60">
                    <td className="px-4 py-3">
                      <input type="checkbox" name="ids" value={`${i.type}:${i.id}`} form="bulk-trash" aria-label={`${i.title} selecteren`} className="h-4 w-4" />
                    </td>
                    <td className="px-4 py-3">
                      <strong>{i.title}</strong>
                      <span className="block font-mono text-xs text-ink-soft">{i.detail}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={i.type === "product" || i.type === "category" ? "brand" : "neutral"}>{ENTITY_LABEL[i.type]}</Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDateTime(i.deletedAt)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={left < 14 ? "danger" : left < 45 ? "warning" : "neutral"}>
                        {left} {left === 1 ? "dag" : "dagen"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <ActionForm action={restoreFromTrash.bind(null, i.type, i.id)} label="Herstellen" />
                        <DeleteButton action={destroyFromTrash.bind(null, i.type, i.id)} label="Definitief verwijderen" confirmText={`"${i.title}" definitief verwijderen? Dit kan niet ongedaan worden gemaakt; ook de revisies verdwijnen.`} />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!items.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-ink-soft">
                    {all.length ? "Niets gevonden met dit filter." : "De prullenbak is leeg."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-4 py-3 text-sm text-ink-soft">
          {items.length} van {all.length} items
        </p>
      </div>
    </>
  );
}
