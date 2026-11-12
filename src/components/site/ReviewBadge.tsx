import Link from "next/link";
import { reviewSummary } from "@/lib/shop";
import { getReviewSettings } from "@/lib/settings";
import { ExternalLink } from "./ExternalLink";
import { GoogleG } from "./icons";

const nl1 = (n: number) => n.toLocaleString("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Sterren op een schaal van 5; de vulling volgt het cijfer (klasse .stars in globals.css). */
export function Stars({ rating, className = "", label }: { rating: number; className?: string; label?: string }) {
  return <span className={`stars ${className}`} style={{ "--rating": rating } as React.CSSProperties} role="img" aria-label={label ?? `${nl1(rating)} van 5 sterren`} />;
}

/**
 * Reviewblok in de header. Bron "google": score en aantal uit de instellingen (opgehaald via de Places API), met
 * link naar het Google-profiel. Bron "site": gemiddelde van de goedgekeurde reviews in de eigen database, met link
 * naar de reviews op de homepage. Zonder score wordt er niets getoond: er wordt nooit een cijfer verzonnen.
 */
export async function ReviewBadge({ className = "" }: { className?: string }) {
  const s = await getReviewSettings();
  if (!s.enabled) return null;
  const google = s.source === "google";
  const { average, count } = google ? { average: s.rating, count: s.count } : await reviewSummary();
  if (!(average > 0) || !(count > 0)) return null;
  const inner = (
    <>
      <span className="flex items-center gap-2">
        {google && <GoogleG className="h-5 w-5 shrink-0" />}
        <Stars rating={average} className="text-[1.05rem]" />
        <span className="text-[1.15rem] font-extrabold leading-none text-ink">
          {nl1(average)} <span className="text-[0.85rem] font-semibold text-muted">/ 5</span>
        </span>
      </span>
      <span className="mt-1 block text-[0.78rem] leading-tight text-muted underline-offset-2 group-hover:text-brand group-hover:underline">
        op basis van {count.toLocaleString("nl-NL")} {google ? "Google reviews" : count === 1 ? "review" : "reviews"}
      </span>
    </>
  );
  const cls = `group block shrink-0 rounded-lg px-2 py-1 ${className}`;
  if (google && s.url)
    return (
      <ExternalLink href={s.url} className={cls}>
        {inner}
      </ExternalLink>
    );
  if (google) return <div className={cls}>{inner}</div>;
  return (
    <Link href="/#reviews" className={cls}>
      {inner}
    </Link>
  );
}
