import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Badge, Notice, PageHeader, Panel, Stat, btnSm, fmtDateTime } from "@/components/admin/ui";
import { purgeExpired } from "@/lib/admin/trash";
import { can, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parse } from "@/lib/json";
import { money } from "@/lib/money";
import { getConnections } from "@/lib/settings";

export const metadata = { title: "Dashboard" };

type Tone = "neutral" | "success" | "warning" | "danger" | "brand";
const ORDER_LABEL: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "Wacht op betaling", tone: "warning" },
  paid: { label: "Betaald, nog verzenden", tone: "brand" },
  shipped: { label: "Verzonden", tone: "success" },
  completed: { label: "Afgerond", tone: "success" },
  cancelled: { label: "Geannuleerd", tone: "neutral" },
  refunded: { label: "Terugbetaald", tone: "danger" },
};
/** Bestellingen die als omzet tellen: betaald en niet geannuleerd of terugbetaald. */
const PAID = ["paid", "shipped", "completed"];

/** Begin van vandaag of van deze maand in Nederlandse tijd. */
function startOf(kind: "day" | "month") {
  const now = new Date();
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(now).map((x) => [x.type, Number(x.value)]));
  const offset = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(now.getTime() / 1000) * 1000;
  return new Date(Date.UTC(p.year, p.month - 1, kind === "day" ? p.day : 1) - offset);
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const purged = await purgeExpired();
  const live = { status: "published", deletedAt: null };
  const paidSince = (from: Date) => ({ status: { in: PAID }, paidAt: { gte: from } });
  const [today, month, toShip, products, lowStock, pages, posts, drafts, newSubs, pendingReviews, orders, logs] = await Promise.all([
    db.order.aggregate({ where: paidSince(startOf("day")), _count: true, _sum: { total: true } }),
    db.order.aggregate({ where: paidSince(startOf("month")), _count: true, _sum: { total: true } }),
    db.order.count({ where: { status: "paid" } }),
    db.product.count({ where: live }),
    db.product.count({ where: { ...live, trackStock: true, stock: { lte: 3 } } }),
    db.page.count({ where: live }),
    db.post.count({ where: live }),
    Promise.all([db.page.count({ where: { status: "draft", deletedAt: null } }), db.post.count({ where: { status: "draft", deletedAt: null } }), db.product.count({ where: { status: "draft", deletedAt: null } })]),
    db.formSubmission.count({ where: { read: false } }),
    db.review.count({ where: { status: "pending" } }),
    db.order.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, number: true, email: true, total: true, status: true, createdAt: true, shippingAddress: true } }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const outOfStock = lowStock ? await db.product.count({ where: { ...live, trackStock: true, stock: { lte: 0 } } }) : 0;
  const [draftPages, draftPosts, draftProducts] = drafts;

  // Connectiestatus alleen ophalen en tonen voor Beheerder en Superadmin
  const admin = can(user, "admin");
  const conn = admin ? await getConnections() : null;
  const connections = conn
    ? [
        { name: "Google Tag Manager", on: conn.gtm.enabled, set: !!conn.gtm.containerId, test: conn.gtm.lastTest, href: "/admin/connecties/google/" },
        { name: "Google Analytics 4", on: conn.ga4.enabled, set: !!conn.ga4.measurementId, test: conn.ga4.lastTest, href: "/admin/connecties/google/" },
        { name: "Search Console", on: conn.gsc.enabled, set: !!conn.gsc.verification, test: conn.gsc.lastTest, href: "/admin/connecties/google/" },
        { name: "Google Reviews", on: conn.googleReviews.enabled, set: !!(conn.googleReviews.placeId && conn.googleReviews.keyEnc), test: conn.googleReviews.lastTest, href: "/admin/connecties/google/" },
        { name: "Mollie (betalingen)", on: conn.mollie.enabled, set: !!(conn.mollie.testKeyEnc || conn.mollie.liveKeyEnc), test: conn.mollie.lastTest, href: "/admin/connecties/betalingen/" },
        { name: "SparkPost (e-mail)", on: conn.sparkpost.enabled, set: !!conn.sparkpost.keyEnc, test: conn.sparkpost.lastTest, href: "/admin/connecties/email/" },
        { name: "AI", on: conn.ai.enabled, set: !!conn.ai.keyEnc, test: conn.ai.lastTest, href: "/admin/connecties/ai/" },
      ]
    : [];
  const hour = Number(new Intl.DateTimeFormat("nl-NL", { hour: "numeric", timeZone: "Europe/Amsterdam" }).format(new Date()));
  const customer = (o: (typeof orders)[number]) => {
    const a = parse<{ firstName?: string; lastName?: string }>(o.shippingAddress, {});
    return [a.firstName, a.lastName].filter(Boolean).join(" ") || o.email;
  };
  return (
    <>
      <PageHeader title={`${hour < 12 ? "Goedemorgen" : hour < 18 ? "Goedemiddag" : "Goedenavond"}, ${user.name.split(" ")[0]}`} description="Een rustig overzicht van de webshop van BluePure Marine." />
      {sp["geen-toegang"] && <Notice tone="danger">Je hebt geen rechten voor die pagina.</Notice>}
      {purged > 0 && <Notice>{purged} items die langer dan 6 maanden in de prullenbak lagen zijn definitief verwijderd.</Notice>}
      {conn?.mollie.simulate && (
        <Notice tone="warning">
          Testbetalingen simuleren staat aan: klanten kunnen afrekenen zonder echt te betalen. Zet dit uit op de live site via{" "}
          <Link href="/admin/connecties/betalingen/" className="underline">
            Connecties → Betalingen
          </Link>
          .
        </Notice>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Omzet vandaag" value={money(today._sum.total ?? 0)} href="/admin/bestellingen/" sub={`${today._count} ${today._count === 1 ? "betaalde bestelling" : "betaalde bestellingen"}`} />
        <Stat label="Omzet deze maand" value={money(month._sum.total ?? 0)} href="/admin/bestellingen/" sub={`${month._count} ${month._count === 1 ? "betaalde bestelling" : "betaalde bestellingen"}`} />
        <Stat label="Nog te verzenden" value={toShip} href="/admin/bestellingen/?status=paid" sub="betaald, wacht op verzending" />
        <Stat label="Reviews ter goedkeuring" value={pendingReviews} href="/admin/reviews/?status=pending" sub="staan nog niet op de site" />
        <Stat label="Producten online" value={products} href="/admin/producten/" sub={draftProducts ? `${draftProducts} als concept` : "alle producten gepubliceerd"} />
        <Stat label="Uitverkocht of bijna op" value={lowStock} href="/admin/producten/?voorraad=bijna-op" sub={`voorraad 3 of minder · ${outOfStock} uitverkocht`} />
        <Stat label="Pagina's en blogs" value={pages + posts} href="/admin/paginas/" sub={`${pages} pagina's · ${posts} blogs · ${draftPages + draftPosts} concepten`} />
        <Stat label="Nieuwe inzendingen" value={newSubs} href="/admin/formulieren/" sub="ongelezen formulierinzendingen" />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/admin/producten/nieuw/" className={btnSm}>
          <Icon name="box" className="h-4 w-4" /> Nieuw product
        </Link>
        <Link href="/admin/blog/nieuw/" className={btnSm}>
          <Icon name="news" className="h-4 w-4" /> Nieuwe blog
        </Link>
        <Link href="/admin/paginas/nieuw/" className={btnSm}>
          <Icon name="pages" className="h-4 w-4" /> Nieuwe pagina
        </Link>
        <Link href="/admin/kortingscodes/nieuw/" className={btnSm}>
          <Icon name="percent" className="h-4 w-4" /> Nieuwe kortingscode
        </Link>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Laatste bestellingen" action={<Link href="/admin/bestellingen/" className={btnSm}>Alle bestellingen</Link>}>
          {orders.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-ink-soft">
                  <tr>
                    <th className="pb-2 pr-3 font-medium">Nummer</th>
                    <th className="pb-2 pr-3 font-medium">Klant</th>
                    <th className="pb-2 pr-3 text-right font-medium">Bedrag</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {orders.map((o) => {
                    const s = ORDER_LABEL[o.status] ?? { label: o.status, tone: "neutral" as Tone };
                    return (
                      <tr key={o.id}>
                        <td className="py-2.5 pr-3">
                          <Link href={`/admin/bestellingen/${o.id}/`} className="font-medium hover:underline">
                            {o.number}
                          </Link>
                          <span className="block text-xs text-ink-soft">{fmtDateTime(o.createdAt)}</span>
                        </td>
                        <td className="py-2.5 pr-3">{customer(o)}</td>
                        <td className="py-2.5 pr-3 text-right whitespace-nowrap">{money(o.total)}</td>
                        <td className="py-2.5">
                          <Badge tone={s.tone}>{s.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-ink-soft">Nog geen bestellingen. Zodra iemand afrekent, zie je de bestelling hier.</p>
          )}
        </Panel>

        <div className="space-y-6">
          {admin && (
            <Panel title="Connecties" action={<Link href="/admin/connecties/" className={btnSm}>Beheren</Link>}>
              <ul className="space-y-2 text-sm">
                {connections.map((c) => (
                  <li key={c.name} className="flex items-center justify-between gap-3">
                    <Link href={c.href} className="hover:underline">
                      {c.name}
                    </Link>
                    <Badge tone={!c.set ? "neutral" : c.test && !c.test.ok ? "danger" : c.on ? "success" : "warning"}>{!c.set ? "niet ingesteld" : c.test && !c.test.ok ? "fout" : c.on ? "actief" : "uit"}</Badge>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel title="Recente activiteit" action={<Link href="/admin/logboek/" className={btnSm}>Logboek</Link>}>
            <ul className="divide-y divide-line text-sm">
              {logs
                .filter((l) => admin || l.entity !== "Connectie")
                .map((l) => (
                  <li key={l.id} className="py-2">
                    <span className="font-medium">{l.userName}</span> <span className="text-ink-soft">{l.action}</span> · {l.summary}
                    <span className="block text-xs text-ink-soft">{fmtDateTime(l.createdAt)}</span>
                  </li>
                ))}
              {!logs.length && <li className="py-2 text-ink-soft">Nog geen activiteit.</li>}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
