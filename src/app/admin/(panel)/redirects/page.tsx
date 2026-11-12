import { bulkRedirects, clearNotFound, deleteRedirect, saveRedirect } from "@/app/admin/actions/manage";
import { BulkBar } from "@/components/admin/BulkBar";
import { DataTable, PER_PAGE, readParams, type Column } from "@/components/admin/DataTable";
import { ActionForm, SimpleForm } from "@/components/admin/SimpleForm";
import { Badge, Field, PageHeader, Panel, btnSm, fmtDate, fmtDateTime, input } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { like } from "@/lib/search";
import type { Redirect } from "@prisma/client";

export const metadata = { title: "Redirects" };

export default async function RedirectsAdmin({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireUser();
  const sp = await searchParams;
  const params = readParams(sp, { sort: "createdAt" }, ["type"]);
  const where = { ...(params.q ? { OR: [{ from: like(params.q) }, { to: like(params.q) }] } : {}), ...(params.filters.type === "301" || params.filters.type === "302" ? { status: Number(params.filters.type) } : {}) };
  const [rows, total, notFound] = await Promise.all([
    db.redirect.findMany({ where, orderBy: { [["from", "to", "createdAt", "hits", "status"].includes(params.sort) ? params.sort : "createdAt"]: params.dir }, skip: (params.page - 1) * PER_PAGE, take: PER_PAGE }),
    db.redirect.count({ where }),
    db.notFoundHit.findMany({ orderBy: [{ hits: "desc" }, { lastAt: "desc" }], take: 50 }),
  ]);
  const cols: Column<Redirect>[] = [
    { key: "from", label: "Oud pad", sortable: true, render: (r) => <span className="font-mono text-xs">{r.from}</span> },
    { key: "to", label: "Nieuw pad", sortable: true, render: (r) => <span className="font-mono text-xs">{r.to}</span> },
    { key: "status", label: "Type", sortable: true, render: (r) => <Badge tone={r.status === 301 ? "neutral" : "warning"}>{r.status === 301 ? "301 permanent" : "302 tijdelijk"}</Badge> },
    { key: "hits", label: "Gebruikt", sortable: true, render: (r) => `${r.hits}×` },
    { key: "createdAt", label: "Sinds", sortable: true, render: (r) => fmtDate(r.createdAt) },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <form action={deleteRedirect.bind(null, r.id)}>
          <button className={btnSm}>Verwijderen</button>
        </form>
      ),
    },
  ];
  return (
    <>
      <PageHeader title="Redirects" description="Doorverwijzingen (301 of 302) van oude naar nieuwe URL's. Wijzig je in het beheer het URL-pad van een pagina, product, categorie of blog, dan wordt hier automatisch een 301-redirect toegevoegd." />
      <BulkBar formId="bulk-redirects" action={bulkRedirects} allIds={[]} options={[{ value: "delete", label: "Verwijderen", confirm: "{n} redirects verwijderen? De oude URL's geven daarna een 404." }]} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <DataTable
          base="/admin/redirects/"
          params={params}
          columns={cols}
          rows={rows}
          total={total}
          searchLabel="Zoek pad"
          selectForm="bulk-redirects"
          filters={[{ name: "type", label: "Type", options: [{ value: "301", label: "301 permanent" }, { value: "302", label: "302 tijdelijk" }] }]}
        />
        <Panel title="Nieuwe redirect">
          <SimpleForm action={saveRedirect} resetOnSuccess>
            <Field label="Oud pad">
              <input name="from" defaultValue={sp.van ?? ""} key={sp.van ?? "leeg"} placeholder="/oude-pagina/" required className={`${input} font-mono`} />
            </Field>
            <Field label="Nieuw pad of URL">
              <input name="to" placeholder="/nieuwe-pagina/" required className={`${input} font-mono`} />
            </Field>
            <Field label="Type">
              <select name="status" className={input}>
                <option value="301">301 – permanent</option>
                <option value="302">302 – tijdelijk</option>
              </select>
            </Field>
          </SimpleForm>
        </Panel>
      </div>
      <Panel title="404-log: opgevraagde pagina's die niet bestaan" className="mt-6" action={notFound.length ? <ActionForm action={clearNotFound} label="Log leegmaken" /> : undefined}>
        {notFound.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-soft">
                  <th className="py-2">Pad</th>
                  <th>Aantal</th>
                  <th>Laatst</th>
                  <th>Verwijzer</th>
                  <th>
                    <span className="sr-only">Actie</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {notFound.map((n) => (
                  <tr key={n.id}>
                    <td className="py-2 pr-3 font-mono text-xs">{n.path}</td>
                    <td className="pr-3">{n.hits}</td>
                    <td className="pr-3 whitespace-nowrap">{fmtDateTime(n.lastAt)}</td>
                    <td className="max-w-xs truncate pr-3 text-xs text-ink-soft">{n.referrer ?? "–"}</td>
                    <td>
                      <a href={`/admin/redirects/?van=${encodeURIComponent(n.path)}`} className="text-xs underline">
                        Redirect maken
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-ink-soft">Nog geen 404&apos;s geregistreerd.</p>
        )}
        <p className="mt-3 text-xs text-ink-soft">Tip: maak voor veelgevraagde paden een redirect naar de juiste pagina aan.</p>
      </Panel>
    </>
  );
}
