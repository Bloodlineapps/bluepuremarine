import { notFound } from "next/navigation";
import { PageView } from "@/components/site/PageView";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

// Voorbeeldweergave van een pagina (ook als concept), alleen voor ingelogde medewerkers. Nooit geïndexeerd.
// Toont de inhoud van de pagina zoals op de site, zonder header en footer.
export const dynamic = "force-dynamic";
export const metadata = { title: "Voorbeeld", robots: { index: false, follow: false } };

export default async function Preview({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const page = await db.page.findUnique({ where: { id: (await params).id } });
  if (!page || page.deletedAt) notFound();
  return (
    <div className="flex min-h-dvh flex-col bg-sheet text-ink">
      <p className="bg-sun px-4 py-2 text-center text-sm font-semibold text-navy">
        Voorbeeld{page.status === "draft" ? " van een concept: deze pagina is nog niet openbaar" : ""}.{" "}
        <a href={`/admin/paginas/${page.id}/bewerken/`} className="underline">
          Terug naar bewerken
        </a>
      </p>
      <main id="main" className="flex-1">
        <PageView page={page} />
      </main>
    </div>
  );
}
