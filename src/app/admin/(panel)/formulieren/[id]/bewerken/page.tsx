import Link from "next/link";
import { notFound } from "next/navigation";
import { saveForm } from "@/app/admin/actions/forms";
import { EditExtras } from "@/components/admin/EditExtras";
import { FormBuilder } from "@/components/admin/FormBuilder";
import { Notice, PageHeader, btnSm } from "@/components/admin/ui";
import { FIXED_FORMS } from "@/lib/admin/labels";
import { can, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseSteps } from "@/lib/forms";
import { strings } from "@/lib/json";

export const metadata = { title: "Formulier aanpassen" };

export default async function EditForm({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const f = await db.form.findUnique({ where: { id } });
  if (!f || f.deletedAt) notFound();
  const usedOn = await db.page.findMany({ where: { deletedAt: null, blocks: { contains: `"formKey":"${f.key}"` } }, select: { path: true, title: true } });
  return (
    <>
      <PageHeader
        title={f.name}
        description={
          <>
            Sleutel <span className="font-mono">{f.key}</span>
            {usedOn.length ? ` · gebruikt op ${usedOn.map((p) => p.path).join(", ")}` : " · nog niet aan een pagina gekoppeld"}
          </>
        }
        action={
          <Link href={`/admin/formulieren/${f.id}/inzendingen/`} className={btnSm}>
            Inzendingen bekijken
          </Link>
        }
      />
      {sp.nieuw && <Notice>Formulier aangemaakt.</Notice>}
      {sp.teruggezet && <Notice>De eerdere versie is teruggezet.</Notice>}
      <FormBuilder
        initial={parseSteps(f.steps)}
        settings={{ ...f, notifyEmails: strings(f.notifyEmails) }}
        action={saveForm.bind(null, f.id)}
        readOnly={!can(user, "user")}
      />
      <EditExtras entity="form" id={f.id} canEdit={can(user, "user")} canTrash={!FIXED_FORMS.includes(f.key)} />
    </>
  );
}
