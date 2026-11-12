"use client";
import { useEffect } from "react";

/** Meldt het niet-bestaande pad aan het 404-log in het beheer (zonder persoonsgegevens). */
export function NotFoundBeacon() {
  useEffect(() => {
    const data = JSON.stringify({ path: location.pathname, referrer: document.referrer || undefined });
    if (!navigator.sendBeacon?.("/api/public/404", new Blob([data], { type: "application/json" }))) fetch("/api/public/404", { method: "POST", body: data, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  }, []);
  return null;
}
