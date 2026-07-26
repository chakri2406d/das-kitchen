import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://das-kitchen.vercel.app";

/**
 * The list of public pages Google should index. Served automatically at
 * /sitemap.xml by Next.js. Add new public routes here as the site grows.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE_URL, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/menu`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
  ];
}
