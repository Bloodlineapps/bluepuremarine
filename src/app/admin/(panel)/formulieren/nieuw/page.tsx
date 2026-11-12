import { saveForm } from "@/app/admin/actions/forms";
import { FormBuilder } from "@/components/admin/FormBuilder";
import { PageHeader } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Nieuw formulier" };

export default async function NewForm() {
  await requireUser();
  return (
    <>
      <PageHeader title="Nieuw formulier" description="Voeg velden en eventueel stappen toe. Koppel het formulier daarna aan een pagina met het blok Formulier." />
      <FormBuilder
        initial={[]}
        settings={{ key: "", name: "", description: "", submitLabel: "Versturen", notifyEmails: ["info@bluepuremarine.com"], notifySubject: "Nieuwe inzending: {formulier}", afterSubmit: "message", successMessage: "Bedankt! We nemen zo snel mogelijk contact met je op.", redirectPath: null, confirmEnabled: false, confirmSubject: "We hebben je bericht ontvangen", confirmText: "", webhookUrl: null, status: "draft" }}
        action={saveForm.bind(null, null)}
        readOnly={false}
      />
    </>
  );
}
