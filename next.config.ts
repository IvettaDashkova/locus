import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root: a parent directory also has a package-lock.json, which would
  // otherwise be inferred as the root and break file tracing on deploy.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
