import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION } from "@/lib/seo";

/**
 * Web App Manifest (/manifest.webmanifest) — makes the app installable and gives crawlers/OSes a
 * name, colors, and icon. Colors match the app's dark theme + primary accent.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Locus — geospatial workspace",
    short_name: "Locus",
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0f",
    theme_color: "#6d4aff",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
