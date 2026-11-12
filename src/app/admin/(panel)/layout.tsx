import { AdminNav } from "@/components/admin/AdminNav";
import { trashCount } from "@/lib/admin/trash";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { logout } from "../actions/auth";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // bolletjes in het menu: betaalde bestellingen die nog verzonden moeten worden, reviews die op goedkeuring
  // wachten, ongelezen inzendingen en items in de prullenbak
  const [orders, reviews, submissions, trash] = await Promise.all([db.order.count({ where: { status: "paid" } }), db.review.count({ where: { status: "pending" } }), db.formSubmission.count({ where: { read: false } }), trashCount()]);
  return (
    <div className="min-h-dvh lg:pl-64">
      <AdminNav user={user} counts={{ orders, reviews, submissions, trash }} logout={logout} />
      <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-10">{children}</main>
    </div>
  );
}
