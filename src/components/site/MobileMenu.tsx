"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Icon } from "@/components/Icon";

/**
 * Uitschuifmenu op mobiel. Een <details>, dus het opent ook zonder JavaScript; met JavaScript sluit het vanzelf na
 * navigeren en met Escape. De inhoud (categorieën, links) wordt op de server gerenderd en als children meegegeven.
 */
export function MobileMenu({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <details ref={ref} className="group/menu lg:hidden">
      <summary className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-lg text-ink hover:bg-paper [&::-webkit-details-marker]:hidden">
        <span className="sr-only">Menu</span>
        <Icon name="menu" className="h-6 w-6 group-open/menu:hidden" />
        <Icon name="close" className="hidden h-6 w-6 group-open/menu:block" />
      </summary>
      <div className="absolute inset-x-0 top-full z-50 max-h-[calc(100dvh-8rem)] overflow-y-auto border-t border-rule bg-sheet shadow-lift">{children}</div>
    </details>
  );
}

/**
 * Sluit de megamenu-panelen (.has-panel) na een klik op een link: zonder dit blijft een paneel open staan zolang de
 * muis erboven hangt, omdat de pagina wisselt zonder herladen. Na de eerstvolgende muis- of focusbeweging werkt
 * hover weer gewoon.
 */
export function PanelCloser() {
  const pathname = usePathname();
  useEffect(() => {
    const panels = Array.from(document.querySelectorAll<HTMLElement>(".has-panel"));
    if (!panels.length) return;
    if (document.activeElement instanceof HTMLElement && panels.some((p) => p.contains(document.activeElement))) document.activeElement.blur();
    const cleanups = panels.map((p) => {
      p.dataset.open = "false";
      const reset = () => {
        delete p.dataset.open;
        off();
      };
      const off = () => {
        p.removeEventListener("mouseenter", reset);
        p.removeEventListener("mouseleave", reset);
        p.removeEventListener("focusin", reset);
      };
      p.addEventListener("mouseenter", reset);
      p.addEventListener("mouseleave", reset);
      p.addEventListener("focusin", reset);
      return () => {
        delete p.dataset.open;
        off();
      };
    });
    return () => cleanups.forEach((c) => c());
  }, [pathname]);
  return null;
}
