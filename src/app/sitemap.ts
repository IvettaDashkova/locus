import type { MetadataRoute } from "next";
import { SITE_URL, PAGES } from "@/lib/seo";

/**
 * XML sitemap at /sitemap.xml — lists the homepage plus every module route so search engines can
 * discover and index them independently (paired with the per-route canonicals). Reuses the same
 * `PAGES` source of truth as the metadata and OG cards, so a new module shows up here automatically.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: SITE_URL, lastModified, changeFrequency: "weekly", priority: 1 },
    ...Object.values(PAGES).map((p) => ({
      url: `${SITE_URL}${p.path}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
