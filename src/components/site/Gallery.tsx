"use client";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";

export type GalleryImage = { src: string; alt: string; width?: number; height?: number };

/**
 * Productgalerij: grote afbeelding met pijltjes (ook pijltjestoetsen), vegen op mobiel, thumbnails, inzoomen bij
 * hover en een lightbox bij klikken (Escape sluit). De eerste afbeelding laadt met voorrang, de rest lazy.
 */
export function Gallery({ images, name, badge }: { images: GalleryImage[]; name: string; badge?: React.ReactNode }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const touch = useRef<number | null>(null);
  const count = images.length;
  const go = useCallback((d: number) => setIndex((i) => (i + d + count) % count), [count]);
  const current = images[Math.min(index, count - 1)];

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    d.addEventListener("keydown", onKey);
    return () => d.removeEventListener("keydown", onKey);
  }, [go]);

  if (!current) return <div className="grid aspect-square place-items-center rounded-card border border-rule bg-paper text-muted">Geen afbeelding beschikbaar</div>;

  const alt = (img: GalleryImage, i: number) => img.alt || `${name}${count > 1 ? `, afbeelding ${i + 1}` : ""}`;
  const swipe = {
    onTouchStart: (e: React.TouchEvent) => (touch.current = e.touches[0].clientX),
    onTouchEnd: (e: React.TouchEvent) => {
      if (touch.current == null || count < 2) return;
      const dx = e.changedTouches[0].clientX - touch.current;
      if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
      touch.current = null;
    },
  };
  const arrow = "absolute top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 cursor-pointer place-items-center rounded-full border border-rule bg-sheet/95 text-ink shadow-card transition-colors hover:border-brand hover:text-brand";

  return (
    <div>
      <div
        role="group"
        aria-roledescription="carrousel"
        aria-label={`Afbeeldingen van ${name}`}
        tabIndex={count > 1 ? 0 : undefined}
        onKeyDown={(e) => {
          if (count < 2) return;
          if (e.key === "ArrowLeft") go(-1);
          if (e.key === "ArrowRight") go(1);
        }}
        className="relative overflow-hidden rounded-card border border-rule bg-white"
        {...swipe}
      >
        <button
          type="button"
          onClick={() => dialog.current?.showModal()}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
          }}
          onMouseLeave={() => setZoom(null)}
          aria-label={`Vergroot afbeelding ${index + 1} van ${count}`}
          className="relative block aspect-square w-full cursor-zoom-in overflow-hidden"
        >
          <Image
            key={current.src}
            src={current.src}
            alt={alt(current, index)}
            width={1200}
            height={1200}
            priority={index === 0}
            sizes="(min-width: 1024px) 42vw, 94vw"
            className="absolute inset-0 h-full w-full object-contain transition-transform duration-200 ease-out motion-reduce:transition-none"
            style={zoom ? { transform: "scale(1.8)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
          />
        </button>
        {badge && <div className="pointer-events-none absolute top-3 left-3 z-10 flex flex-col items-start gap-1.5">{badge}</div>}
        {count > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Vorige afbeelding" className={`${arrow} left-2`}>
              <Icon name="chevronLeft" className="h-5 w-5" strokeWidth={2.2} />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Volgende afbeelding" className={`${arrow} right-2`}>
              <Icon name="chevronRight" className="h-5 w-5" strokeWidth={2.2} />
            </button>
            <p className="absolute right-3 bottom-3 rounded-full bg-navy/80 px-2.5 py-0.5 text-[0.78rem] font-semibold text-white tabular-nums" aria-live="polite">
              {index + 1} / {count}
            </p>
          </>
        )}
      </div>

      {count > 1 && (
        <ul className="no-scrollbar mt-3 flex gap-2 overflow-x-auto p-1" aria-label="Kies een afbeelding">
          {images.map((img, i) => (
            <li key={img.src} className="shrink-0">
              <button type="button" onClick={() => setIndex(i)} aria-label={`Toon afbeelding ${i + 1}`} aria-current={i === index ? "true" : undefined} className={`relative block h-18 w-18 cursor-pointer overflow-hidden rounded-lg border-2 bg-white transition-colors sm:h-20 sm:w-20 ${i === index ? "border-brand" : "border-rule hover:border-brand-600"}`}>
                <Image src={img.src} alt="" width={160} height={160} sizes="80px" loading="lazy" className="absolute inset-0 h-full w-full object-contain" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <dialog ref={dialog} aria-label={`Vergrote afbeelding van ${name}`} onClick={(e) => e.target === e.currentTarget && dialog.current?.close()} className="m-auto h-[min(92dvh,60rem)] w-[min(94vw,60rem)] max-w-none rounded-card bg-white p-0 backdrop:bg-navy-900/80" {...swipe}>
        <div className="relative h-full w-full">
          <Image src={current.src} alt={alt(current, index)} width={1200} height={1200} sizes="94vw" loading="lazy" className="absolute inset-0 h-full w-full object-contain p-4 sm:p-8" />
          <button type="button" onClick={() => dialog.current?.close()} aria-label="Sluiten" className="absolute top-3 right-3 z-10 grid h-11 w-11 cursor-pointer place-items-center rounded-full bg-navy text-white hover:bg-brand">
            <Icon name="close" className="h-5 w-5" strokeWidth={2.2} />
          </button>
          {count > 1 && (
            <>
              <button type="button" onClick={() => go(-1)} aria-label="Vorige afbeelding" className={`${arrow} left-3`}>
                <Icon name="chevronLeft" className="h-5 w-5" strokeWidth={2.2} />
              </button>
              <button type="button" onClick={() => go(1)} aria-label="Volgende afbeelding" className={`${arrow} right-3`}>
                <Icon name="chevronRight" className="h-5 w-5" strokeWidth={2.2} />
              </button>
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
