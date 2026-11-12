import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// 1) /admin/ afschermen (pagina's en server actions controleren rechten daarnaast zelf).
// 2) Eén vorm per URL: https met www (productie) en altijd een slash aan het eind → in één stap een 301.
// 3) Redirects uit het beheer (/admin/redirects/), o.a. de oude WordPress-URL's (/nl/…, /en/…) naar de nieuwe.
// Geen automatische taalredirect op basis van IP-adres of browsertaal.
// 4) X-Robots-Tag noindex op alles wat niet het productiedomein is (previews, test-hosts).
const PROD_HOST = new URL(process.env.SITE_URL || "https://www.bluepuremarine.com").host;

let cache: { at: number; map: Map<string, { to: string; status: number }> } | null = null;
async function redirects() {
  // Kort bewaren: een nieuwe redirect (bv. na een gewijzigde product-URL) werkt binnen enkele seconden
  if (cache && Date.now() - cache.at < 5_000) return cache.map;
  try {
    const rows = await db.redirect.findMany({ select: { from: true, to: true, status: true } });
    cache = { at: Date.now(), map: new Map(rows.map((r) => [r.from, { to: r.to, status: r.status }])) };
  } catch {
    cache = { at: Date.now(), map: cache?.map ?? new Map() };
  }
  return cache.map;
}

export async function middleware(req: NextRequest) {
  // Bewust een gewone URL: NextURL past trailingSlash zelf aan bij het formatteren.
  const url = new URL(req.url);
  const { pathname } = url;
  const host = req.headers.get("host") ?? "";
  const isFile = /\.[a-z0-9]{2,5}$/i.test(pathname);
  const isApi = pathname.startsWith("/api/") || pathname.startsWith("/_next/");

  if (pathname.startsWith("/admin")) {
    if (!pathname.endsWith("/") && !isFile) {
      url.pathname = `${pathname}/`;
      return NextResponse.redirect(url, 301);
    }
    if (pathname.startsWith("/admin/login/")) return NextResponse.next();
    const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
    if (!session) {
      url.pathname = "/admin/login/";
      url.search = `?terug=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }
  if (isApi) return NextResponse.next();

  // Canonieke host en protocol (alleen op het eigen domein, niet lokaal of op previews)
  let changed = false;
  if (process.env.NODE_ENV === "production" && /(^|\.)bluepuremarine\.com$/.test(host.split(":")[0])) {
    if (host !== PROD_HOST) {
      url.host = PROD_HOST;
      url.port = "";
      changed = true;
    }
    if (req.headers.get("x-forwarded-proto") === "http") {
      url.protocol = "https:";
      changed = true;
    }
  }
  if (!isFile && !pathname.endsWith("/")) {
    url.pathname = `${pathname}/`;
    changed = true;
  }
  const from = url.pathname.toLowerCase();
  const target = (await redirects()).get(from);
  if (target) {
    // Teller "Gebruikt" in het beheer: niet op wachten, fouten negeren
    void db.redirect.updateMany({ where: { from }, data: { hits: { increment: 1 } } }).catch(() => {});
    const dest = new URL(target.to, url);
    dest.search = url.search;
    return NextResponse.redirect(dest, target.status === 302 ? 302 : 301);
  }
  if (changed) return NextResponse.redirect(url, 301);

  const res = NextResponse.next();
  if (host && host !== PROD_HOST) res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|uploads/|brands/|og/|favicon.ico|icon.png|icon-512.png|apple-touch-icon.png|logo.svg|og-default.jpg).*)"],
};
