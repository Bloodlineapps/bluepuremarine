import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Productie-build in een eigen map (NEXT_DIST_DIR=.next-prod) zodat de dev-server ongestoord doorloopt.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Alle URL's eindigen op een slash, net als op de oude WordPress-site. De 301 naar de slash-variant
  // doet src/middleware.ts zelf (Next zou een 308 geven).
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [390, 640, 828, 1080, 1440, 1920],
    imageSizes: [96, 160, 256, 384],
  },
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
    // Aantal build-workers begrenzen (scripts/replit-build.mjs zet 2): minder gelijktijdige databaseverbindingen.
    ...(process.env.NEXT_BUILD_CPUS ? { cpus: Number(process.env.NEXT_BUILD_CPUS) } : {}),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/uploads/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    ];
  },
};

export default nextConfig;
