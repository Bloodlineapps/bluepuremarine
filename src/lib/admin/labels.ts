// Vaste labels voor het beheer (ook gebruikt in client components, dus geen server-only).
export const SECTIONS: Record<string, string> = { home: "Homepage", klantenservice: "Klantenservice", juridisch: "Juridisch", overig: "Overig" };
export const TEMPLATES: Record<string, string> = { default: "Standaard", home: "Homepage", faq: "Veelgestelde vragen", contact: "Contact", legal: "Juridisch" };

/** Rolnamen zoals ze in het beheer getoond worden (sleutels uit de tabel Role). */
export const ROLE_LABELS: Record<string, string> = { superadmin: "Superadmin", admin: "Beheerder", user: "Gebruiker" };
export const ROLE_RIGHTS: Record<string, string> = {
  superadmin: "Alles, inclusief het beheren van andere superadmins",
  admin: "Alles van een gebruiker, plus connecties (Google, Mollie, e-mail, AI) bekijken en beheren",
  user: "Alles zien, aanmaken, aanpassen en verwijderen, behalve connecties",
};

/** Namen van alle soorten content met revisies en/of een plek in de prullenbak. */
export const ENTITY_NAMES: Record<string, string> = { page: "Pagina", faq: "Veelgestelde vraag", form: "Formulier", product: "Product", category: "Categorie", post: "Blogartikel" };

/** Formulieren die de site op een vaste plek gebruikt: niet te verwijderen. */
export const FIXED_FORMS = ["contact"];
