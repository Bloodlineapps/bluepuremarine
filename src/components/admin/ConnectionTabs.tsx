"use client";
import { SubTabs } from "./SubTabs";

export const CONNECTION_TABS = [
  { href: "/admin/connecties/google/", label: "Google" },
  { href: "/admin/connecties/betalingen/", label: "Betalingen" },
  { href: "/admin/connecties/email/", label: "E-mail" },
  { href: "/admin/connecties/ai/", label: "AI" },
];

export function ConnectionTabs() {
  return <SubTabs tabs={CONNECTION_TABS} label="Connecties" />;
}
