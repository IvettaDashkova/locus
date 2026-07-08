import type { NextConfig } from "next";

// Baseline Content-Security-Policy. Locks down framing, base-uri, form-action and object/embed, and
// scopes network/asset origins. `script-src` keeps 'unsafe-inline'/'unsafe-eval' because Next injects
// inline bootstrap scripts (no nonce wired) and dev/HMR needs eval — a future hardening is nonce-based
// script-src. `connect-src https:` covers the no-key data APIs (OpenFreeMap tiles, Nominatim,
// OpenRouteService, Open-Meteo); `worker-src blob:` and `img-src blob:` are required by MapLibre GL.
const CSP_DIRECTIVES = {
  "default-src": ["'self'"],
  "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:", "blob:", "https:"],
  "font-src": ["'self'", "data:"],
  "connect-src": ["'self'", "https:"],
  "worker-src": ["'self'", "blob:"],
  "frame-ancestors": ["'self'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "object-src": ["'none'"],
};

const serialize = (directives: Record<string, string[]>) =>
  Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(" ")}`)
    .join("; ");

const CSP = serialize(CSP_DIRECTIVES);

// The Swagger UI docs page (/api/docs) pulls its bundle + stylesheet from the pinned jsDelivr CDN,
// so it needs that origin whitelisted in script-src/style-src. This is scoped to the docs route
// only — the baseline CSP above stays strict for the rest of the app.
const DOCS_CSP = serialize({
  ...CSP_DIRECTIVES,
  "script-src": [...CSP_DIRECTIVES["script-src"], "https://cdn.jsdelivr.net"],
  "style-src": [...CSP_DIRECTIVES["style-src"], "https://cdn.jsdelivr.net"],
});

const nextConfig: NextConfig = {
  // Pin the workspace root: a parent directory also has a package-lock.json, which would
  // otherwise be inferred as the root and break file tracing on deploy.
  turbopack: {
    root: __dirname,
  },
  // Load searoute-js (and its geojson-path-finder / priority-queue deps) via native Node require at
  // runtime instead of bundling it — the bundler mangles the queue dependency's CJS interop
  // ("Queue is not a constructor"). It only runs in the /api/tracks/build Node route.
  serverExternalPackages: ["searoute-js"],
  // Don't advertise the framework.
  poweredByHeader: false,
  async headers() {
    const commonHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "X-DNS-Prefetch-Control", value: "on" },
    ];
    return [
      // Docs page gets a CSP that also allows the jsDelivr CDN for Swagger UI's assets.
      {
        source: "/api/docs",
        headers: [{ key: "Content-Security-Policy", value: DOCS_CSP }, ...commonHeaders],
      },
      // Everything else keeps the strict baseline CSP. The negative lookahead excludes the docs
      // route so it doesn't also receive the strict header (two CSP headers = enforced intersection).
      {
        source: "/((?!api/docs$).*)",
        headers: [{ key: "Content-Security-Policy", value: CSP }, ...commonHeaders],
      },
    ];
  },
};

export default nextConfig;
