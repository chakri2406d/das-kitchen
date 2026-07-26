import type { MetadataRoute } from "next";

// Set NEXT_PUBLIC_SITE_URL in Vercel once you have a custom domain; until then
// it falls back to the Vercel address.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://das-kitchen.vercel.app";

/**
 * Tells search engines what they may crawl. The public pages are open; the
 * private/dashboard and checkout areas are kept out of search results.
 * Served automatically at /robots.txt by Next.js.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/delivery",
        "/auth",
        "/api",
        "/cart",
        "/checkout",
        "/orders",
        "/login",
        "/signup",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
