import Link from "next/link";
import { moveToTrash } from "@/app/admin/actions/content";
import type { Entity } from "@/lib/admin/revisions";
import type { TrashType } from "@/lib/admin/trash";
import { db } from "@/lib/db";
import { DeleteButton } from "./fields";
import { Panel, btnSm, fmtDateTime } from "./ui";

/** Onder elk bewerkscherm: de laatste revisies (met vergelijken/terugzetten) en "naar de prullenbak". */
export async function EditExtras({ entity, id, canEdit, canTrash = true }: { entity: Entity; id: string; canEdit: boolean; canTrash?: boolean }) {
  const revs = await db.revision.findMany({ where: { entity, entityId: id }, orderBy: { createdAt: "desc" }, take: 6 });
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
      <Panel title="Revisiegeschiedenis" action={<Link href={`/admin/revisiegeschiedenis/${entity}/${id}/`} className={btnSm}>Alle revisies en vergelijken</Link>}>
        {revs.length ? (
          <ul className="divide-y divide-line text-sm">
            {revs.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <strong>{fmtDateTime(r.createdAt)}</strong> · {r.userName}
                  <span className="block text-xs text-ink-soft">{r.changes || "—"}</span>
                </span>
                <Link href={`/admin/revisiegeschiedenis/${entity}/${id}/?a=${r.id}`} className="text-xs underline">
                  Bekijken
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-soft">Nog geen revisies. Na de eerste keer opslaan verschijnt hier elke wijziging.</p>
        )}
      </Panel>
      {canEdit && canTrash && (
        <Panel title="Verwijderen">
          <p className="mb-3 text-sm text-ink-soft">Het item gaat naar de prullenbak en blijft daar 6 maanden bewaard.</p>
          <DeleteButton action={moveToTrash.bind(null, entity as TrashType, id)} label="Naar de prullenbak" confirmText="Naar de prullenbak verplaatsen? Je kunt het item 6 maanden lang herstellen." />
        </Panel>
      )}
    </div>
  );
}
