"use client";
import { useEffect } from "react";

/**
 * Laat elementen met de klasse `reveal` infaden zodra ze in beeld komen (voegt `is-in` toe). Staat één keer in de
 * layout en volgt ook inhoud die later wordt toegevoegd (navigeren, filteren). Zonder IntersectionObserver of bij
 * "minder beweging" is alles direct zichtbaar; zonder JavaScript regelt een <noscript>-stijl in de head dat.
 */
export function Reveal() {
  useEffect(() => {
    const show = (el: Element) => el.classList.add("is-in");
    const pending = () => document.querySelectorAll(".reveal:not(.is-in)");
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const all = () => pending().forEach(show);
      all();
      const mo = new MutationObserver(all);
      mo.observe(document.body, { childList: true, subtree: true });
      return () => mo.disconnect();
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            show(e.target);
            io.unobserve(e.target);
          }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );
    let frame = 0;
    const scan = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => pending().forEach((el) => io.observe(el)));
    };
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      mo.disconnect();
      io.disconnect();
    };
  }, []);
  return null;
}
