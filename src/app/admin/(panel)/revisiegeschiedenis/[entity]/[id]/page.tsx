import Link from "next/link";
import { notFound } from "next/navigation";
import { restoreRevisionAction } from "@/app/admin/actions/content";
import { DeleteButton } from "@/components/admin/fields";
import { PageHeader, Panel, btnSm, fmtDateTime } from "@/components/admin/ui";
import { EDIT_URL, ENTITY_LABEL, FIELD_LABEL, diffKeys, type Entity } from "@/lib/admin/revisions";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { plain } from "@/lib/text";

export const metadata = { title: "Revisies vergelijken" };

/** Woordverschil tussen twee teksten (eenvoudige LCS op woorden), voor een leesbare vergelijking. */
function wordDiff(a: string, b: string) {
  const x = a.split(/(\s+)/);
  const y = b.split(/(\s+)/);
  if (x.length * y.length > 4_000_000) return [{ t: "del" as const, v: a }, { t: "add" as const, v: b }];
  const dp = Array.from({ length: x.length + 1 }, () => new Uint32Array(y.length + 1));
  for (let i = x.length - 1; i >= 0; i--) for (let j = y.length - 1; j >= 0; j--) dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: { t: "same" | "add" | "del"; v: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < x.length && j < y.length) {
    if (x[i] === y[j]) out.push({ t: "same", v: x[i++] }), j++;
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ t: "del", v: x[i++] });
    else out.push({ t: "add", v: y[j++] });
  }
  while (i < x.length) out.push({ t: "del", v: x[i++] });
  while (j < y.length) out.push({ t: "add", v: y[j++] });
  return out;
}
const show = (v: unknown) => (typeof v === "string" ? (/<[a-z][\s\S]*>/i.test(v) ? plain(v) : v) : JSON.stringify(v ?? ""));

export default async function Compare({ params, searchParams }: { params: Promise<{ entity: string; id: string }>; searchParams: Promise<Record<string, string>> }) {
  await requireUser();
  const { entity, id } = await params;
  const sp = await searchParams;
  if (!(entity in ENTITY_LABEL)) notFound();
  const revs = await db.revision.findMany({ where: { entity, entityId: id }, orderBy: { createdAt: "desc" } });
  if (!revs.length) notFound();
  // a = nieuwere versie, b = oudere versie om mee te vergelijken
  const a = revs.find((r) => r.id === sp.a) ?? revs[0];
  const b = revs.find((r) => r.id === sp.b) ?? revs[revs.indexOf(a) + 1] ?? null;
  const da = JSON.parse(a.data) as Record<string, unknown>;
  const db_ = b ? (JSON.parse(b.data) as Record<string, unknown>) : null;
  const changed = db_ ? diffKeys(db_, da) : [];
  return (
    <>
      <PageHeader
        title={`${ENTITY_LABEL[entity as Entity]}: ${a.title}`}
        description={`${revs.length} revisies`}
        action={
          <Link href={EDIT_URL[entity as Entity](id)} className={btnSm}>
            Naar het bewerkscherm
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Panel title="Alle revisies">
          <form action="" className="space-y-1 text-sm">
            <p className="mb-2 text-xs text-ink-soft">Kies twee versies (A = nieuwer, B = ouder) en klik op Vergelijken.</p>
            <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
              {revs.map((r) => (
                <li key={r.id} className={`rounded-xl px-2 py-1.5 ${r.id === a.id ? "bg-lilac" : r.id === b?.id ? "bg-cream-2" : ""}`}>
                  <span className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-xs">
                      <input type="radio" name="a" value={r.id} defaultChecked={r.id === a.id} /> A
                    </label>
                    <label className="flex items-center gap-1 text-xs">
                      <input type="radio" name="b" value={r.id} defaultChecked={r.id === b?.id} /> B
                    </label>
                    <strong>{fmtDateTime(r.createdAt)}</strong>
                  </span>
                  <span className="block pl-[4.6rem] text-xs text-ink-soft">
                    {r.userName} · {r.changes}
                  </span>
                </li>
              ))}
            </ul>
            <button className={`${btnSm} mt-3`}>Vergelijken</button>
          </form>
        </Panel>
        <div className="space-y-6">
          <Panel title={b ? `Verschil: B (${fmtDateTime(b.createdAt)}) → A (${fmtDateTime(a.createdAt)})` : `Versie van ${fmtDateTime(a.createdAt)}`}>
            {!b && <p className="text-sm text-ink-soft">Dit is de oudste versie; er is niets om mee te vergelijken.</p>}
            {b && !changed.length && <p className="text-sm text-ink-soft">Geen inhoudelijke verschillen tussen deze twee versies.</p>}
            <div className="space-y-5">
              {changed.map((k) => (
                <div key={k}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-soft">{FIELD_LABEL[k] ?? k}</p>
                  <p className="rounded-xl border border-line bg-white p-3 text-sm leading-relaxed">
                    {wordDiff(show(db_![k]), show(da[k])).map((p, i) =>
                      p.t === "same" ? (
                        <span key={i}>{p.v}</span>
                      ) : p.t === "add" ? (
                        <ins key={i} className="bg-success/15 text-success no-underline">
                          {p.v}
                        </ins>
                      ) : (
                        <del key={i} className="bg-danger/10 text-danger">
                          {p.v}
                        </del>
                      ),
                    )}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
          {(
            <Panel title="Terugzetten">
              <p className="mb-3 text-sm text-ink-soft">Zet de inhoud terug naar een eerdere versie. De huidige versie blijft bewaard als revisie, dus ook dit is weer ongedaan te maken.{entity === "product" ? " Bij een product worden ook de varianten en categorieën teruggezet; de voorraad blijft zoals hij nu is." : ""}</p>
              <div className="flex flex-wrap gap-3">
                {[a, b].filter(Boolean).map((r) =>
                  r!.id === revs[0].id ? null : (
                    <div key={r!.id} className="w-64">
                      <DeleteButton action={restoreRevisionAction.bind(null, r!.id)} label={`Terugzetten naar ${fmtDateTime(r!.createdAt)}`} confirmText={`De versie van ${fmtDateTime(r!.createdAt)} terugzetten?`} />
                    </div>
                  ),
                )}
                {a.id === revs[0].id && !b && <p className="text-sm text-ink-soft">Kies een oudere versie (A of B) om terug te zetten.</p>}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
