import Link from "next/link";
import { bulkUsers, deleteUser, saveUser } from "@/app/admin/actions/manage";
import { BulkBar } from "@/components/admin/BulkBar";
import { DeleteButton } from "@/components/admin/fields";
import { SimpleForm } from "@/components/admin/SimpleForm";
import { Badge, Field, Notice, PageHeader, Panel, btn, fmtDate, fmtDateTime, input } from "@/components/admin/ui";
import { ROLE_LABELS, ROLE_RIGHTS } from "@/lib/admin/labels";
import { ensureRoles, rank } from "@/lib/admin/roles";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { like } from "@/lib/search";

export const metadata = { title: "Gebruikers" };

const SORTS = { naam: "Naam", rol: "Rol", login: "Laatst ingelogd", nieuw: "Aangemaakt" } as const;

// Gebruikers van het beheer. Iedereen kan gebruikers beheren tot en met zijn eigen rol: je kunt geen hogere rol
// toekennen en geen account met een hogere rol wijzigen of verwijderen (de server controleert dat bij elke actie).
export default async function UsersAdmin({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireUser();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const sort = sp.sorteer && sp.sorteer in SORTS ? (sp.sorteer as keyof typeof SORTS) : "naam";
  const roles = await ensureRoles();
  const where = { ...(q ? { OR: [{ name: like(q) }, { email: like(q) }] } : {}), ...(sp.rol && roles.some((r) => r.key === sp.rol) ? { role: { key: sp.rol } } : {}) };
  const users = await db.user.findMany({ where, include: { role: true }, orderBy: { name: "asc" } });
  if (sort === "rol") users.sort((a, b) => rank(b.role.key) - rank(a.role.key));
  if (sort === "login") users.sort((a, b) => (b.lastLoginAt?.getTime() ?? 0) - (a.lastLoginAt?.getTime() ?? 0));
  if (sort === "nieuw") users.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const edit = sp.bewerk ? await db.user.findUnique({ where: { id: sp.bewerk }, include: { role: true } }) : null;
  const myRank = rank(me.role);
  const mayManage = (roleKey: string) => rank(roleKey) <= myRank;
  const assignable = roles.filter((r) => mayManage(r.key));
  const canEdit = !edit || mayManage(edit.role.key);
  const label = (key: string) => ROLE_LABELS[key] ?? key;
  return (
    <>
      <PageHeader title="Gebruikers en rollen" description="Wie kan inloggen op het beheer en met welke rol. Je kunt geen rol toekennen die hoger is dan je eigen rol; rechten worden bij elke actie op de server gecontroleerd." />
      {sp.opgeslagen && <Notice>Gebruiker opgeslagen.</Notice>}
      {sp.verwijderd && <Notice>Gebruiker verwijderd.</Notice>}
      {sp.fout && <Notice tone="danger">{sp.fout}</Notice>}
      <BulkBar
        formId="bulk-users"
        action={bulkUsers}
        allIds={[]}
        options={[...assignable.map((r) => ({ value: `role:${r.key}`, label: `Rol wijzigen naar ${label(r.key)}`, confirm: `{n} gebruikers de rol ${label(r.key)} geven?` })), { value: "delete", label: "Verwijderen", confirm: "{n} gebruikers verwijderen? Ze kunnen daarna niet meer inloggen." }]}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <form action="/admin/gebruikers/" className="flex flex-wrap items-end gap-3 border-b border-line p-4" role="search">
            <input name="q" defaultValue={q} placeholder="Zoek op naam of e-mailadres" type="search" className={`${input} min-w-[180px] flex-1`} aria-label="Zoeken" />
            <select name="rol" defaultValue={sp.rol ?? ""} className={`${input} !w-auto`} aria-label="Rol">
              <option value="">Rol: alle</option>
              {roles.map((r) => (
                <option key={r.key} value={r.key}>
                  {label(r.key)}
                </option>
              ))}
            </select>
            <select name="sorteer" defaultValue={sort} className={`${input} !w-auto`} aria-label="Sorteren">
              {Object.entries(SORTS).map(([v, l]) => (
                <option key={v} value={v}>
                  Sorteer: {l}
                </option>
              ))}
            </select>
            <button className={btn}>Filter</button>
            {(q || sp.rol) && (
              <Link href="/admin/gebruikers/" className="text-sm underline">
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
                  <th className="px-4 py-3 font-medium">Naam</th>
                  <th className="px-4 py-3 font-medium">Rol</th>
                  <th className="px-4 py-3 font-medium">Laatst ingelogd</th>
                  <th className="px-4 py-3 font-medium">Aangemaakt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.map((u) => (
                  <tr key={u.id} className={edit?.id === u.id ? "bg-brand-50" : "hover:bg-cream/60"}>
                    <td className="px-4 py-3">{u.id !== me.id && mayManage(u.role.key) && <input type="checkbox" name="ids" value={u.id} form="bulk-users" className="h-4 w-4" aria-label={`${u.name} selecteren`} />}</td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/gebruikers/?bewerk=${u.id}`} className="font-medium hover:underline">
                        {u.name}
                      </Link>
                      {u.id === me.id && <span className="ml-2 text-xs text-ink-soft">(jij)</span>}
                      <p className="text-xs text-ink-soft">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={u.role.key === "superadmin" ? "brand" : u.role.key === "admin" ? "success" : "neutral"}>{label(u.role.key)}</Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : <span className="text-ink-soft">nog nooit</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(u.createdAt)}</td>
                  </tr>
                ))}
                {!users.length && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-ink-soft">
                      Niets gevonden.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-line p-4 text-sm">
            <p className="mb-2 font-medium">Rollen</p>
            <ul className="space-y-1 text-ink-soft">
              {[...roles].reverse().map((r) => (
                <li key={r.id}>
                  <strong className="text-ink">{label(r.key)}</strong>: {ROLE_RIGHTS[r.key]}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="space-y-4">
          <Panel title={edit ? `Bewerk ${edit.name}` : "Nieuwe gebruiker"} action={edit && <Link href="/admin/gebruikers/" className="text-xs underline">+ Nieuw</Link>}>
            {canEdit ? (
              <SimpleForm action={saveUser.bind(null, edit?.id ?? null)} key={edit?.id ?? "new"}>
                <Field label="Naam">
                  <input name="name" defaultValue={edit?.name} required className={input} />
                </Field>
                <Field label="E-mailadres">
                  <input name="email" type="email" defaultValue={edit?.email} required className={input} autoComplete="off" />
                </Field>
                <Field label="Rol" hint="(maximaal je eigen rol)">
                  <select name="roleId" defaultValue={edit?.roleId ?? assignable[0]?.id} className={input}>
                    {assignable.map((r) => (
                      <option key={r.id} value={r.id}>
                        {label(r.key)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={edit ? "Nieuw wachtwoord" : "Wachtwoord"} hint={edit ? "(leeg = ongewijzigd, anders min. 12 tekens)" : "(min. 12 tekens)"}>
                  <input name="password" type="password" autoComplete="new-password" className={input} />
                </Field>
              </SimpleForm>
            ) : (
              <p className="text-sm text-ink-soft">
                {edit!.name} heeft de rol {label(edit!.role.key)}. Dat is hoger dan jouw rol ({label(me.role)}): je kunt dit account bekijken, maar niet wijzigen of verwijderen.
              </p>
            )}
            {edit && (
              <p className="mt-4 border-t border-line pt-3 text-xs text-ink-soft">
                Laatst ingelogd: {edit.lastLoginAt ? fmtDateTime(edit.lastLoginAt) : "nog nooit"} · aangemaakt op {fmtDate(edit.createdAt)}
              </p>
            )}
          </Panel>
          {edit && edit.id !== me.id && canEdit && <DeleteButton action={deleteUser.bind(null, edit.id)} label="Gebruiker verwijderen" confirmText={`${edit.name} verwijderen? Deze persoon kan daarna niet meer inloggen.`} />}
        </div>
      </div>
    </>
  );
}
