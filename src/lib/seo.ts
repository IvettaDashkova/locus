import type { Metadata } from "next";

/** The canonical production origin — must match `metadataBase` in the root layout. */
export const SITE_URL = "https://locus-dun.vercel.app";

export const SITE_DESCRIPTION =
  "An AI-orchestrated geospatial workspace by Ivetta Dashkova — four AI-driven modules over one shared map (Capture, Ask, Act, Tracks), plus a live Navigation Lab. Built on Next.js, PostGIS and pgvector.";

/** Author profile — the single source for the Person structured data and social links. */
export const PROFILE = {
  name: "Ivetta Dashkova",
  jobTitle: "Front End / Full Stack Developer",
  portfolio: "https://portfolio.ivettadashkova.com/",
  github: "https://github.com/IvettaDashkova/locus",
  linkedin: "https://linkedin.com/in/ivettadashkova",
};

/**
 * Schema.org structured data (JSON-LD) describing the site, its author, and the app. Emitted in the
 * root layout so it applies site-wide; the `@id` cross-references let search engines connect the
 * WebSite ↔ Person ↔ WebApplication into one knowledge graph (rich results, author attribution).
 */
export function structuredData(): Record<string, unknown> {
  const person = { "@id": `${SITE_URL}/#person` };
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: "Locus",
        description: SITE_DESCRIPTION,
        inLanguage: ["en", "uk", "pl"],
        author: person,
      },
      {
        "@type": "Person",
        "@id": `${SITE_URL}/#person`,
        name: PROFILE.name,
        url: PROFILE.portfolio,
        jobTitle: PROFILE.jobTitle,
        sameAs: [PROFILE.github, PROFILE.linkedin, PROFILE.portfolio],
      },
      {
        "@type": "WebApplication",
        "@id": `${SITE_URL}/#app`,
        name: "Locus",
        url: SITE_URL,
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Web",
        description: SITE_DESCRIPTION,
        author: person,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
      {
        "@type": "SoftwareSourceCode",
        "@id": `${SITE_URL}/#source`,
        name: "Locus",
        codeRepository: PROFILE.github,
        programmingLanguage: ["TypeScript", "SQL"],
        author: person,
      },
    ],
  };
}

export type ModuleKey = "capture" | "ask" | "act" | "tracks" | "lab";

type PageSeo = {
  /** Route path — used verbatim for the canonical URL and og:url (resolved against metadataBase). */
  path: string;
  /** Short name for the `<title>` (the root template appends " — Locus"). */
  name: string;
  /** Page-specific description for `<meta description>`, og:description and twitter:description. */
  description: string;
  /** One-line strapline rendered on the generated OG card. */
  tagline: string;
};

/**
 * Single source of truth for every module's SEO copy. Both `buildMetadata()` (the per-route
 * `<head>` tags) and the generated OG cards (`og-image.tsx`) read from here, so the share preview
 * can never drift from the page's real title/description.
 */
export const PAGES: Record<ModuleKey, PageSeo> = {
  capture: {
    path: "/capture",
    name: "Capture",
    description:
      "Build data-entry forms from a plain-English prompt: the LLM emits a Zod-guarded JSON Schema and location fields render as real map widgets over PostGIS.",
    tagline: "Prompt → JSON Schema → geo form",
  },
  ask: {
    path: "/ask",
    name: "Ask",
    description:
      "A geospatial RAG assistant over your data and open sources — cited answers behind a grounding gate, plus a map of every place mentioned. pgvector + hybrid search.",
    tagline: "Grounded, cited geospatial Q&A",
  },
  act: {
    path: "/act",
    name: "Act",
    description:
      "An AI agent with geo tools — geocode, route, isochrone, nearby, weather — exposed over MCP and drawn live on the shared map through multi-step tool-calling.",
    tagline: "An agent with geo tools, over MCP",
  },
  tracks: {
    path: "/tracks",
    name: "Tracks",
    description:
      "Import GPS trajectories, compute movement metrics, replay them on an animated map, and get a grounded AI briefing. PostGIS geography with stay-point stop detection.",
    tagline: "GPS trajectory analytics & playback",
  },
  lab: {
    path: "/lab",
    name: "Navigation Lab",
    description:
      "Seven common map & navigation problems shown live, in plain language, each with the fix and its business impact — GPS smoothing, coordinate order, the antimeridian, distance accuracy, track simplification, marker clustering, and shareable map state.",
    tagline: "Seven map bugs, shown live and fixed",
  },
};

/**
 * Build a route's `Metadata`. Sets a page-specific canonical + og:url (fixing the root-canonical
 * duplicate-content signal) and page-specific og/twitter title+description so shares of an
 * individual module preview that module — not the generic site blurb. The colocated `og-image.tsx`
 * supplies the (landscape) og:image/twitter:image, so images are intentionally omitted here.
 */
export function buildMetadata(key: ModuleKey): Metadata {
  const p = PAGES[key];
  const ogTitle = `${p.name} — Locus`; // matches the rendered <title> (root template = "%s — Locus")
  return {
    title: p.name,
    description: p.description,
    alternates: { canonical: p.path },
    openGraph: {
      type: "website",
      url: p.path,
      siteName: "Locus",
      title: ogTitle,
      description: p.description,
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: p.description,
    },
  };
}
