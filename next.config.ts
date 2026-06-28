import type { NextConfig } from "next";

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
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
    ];
  },
};

export default nextConfig;
