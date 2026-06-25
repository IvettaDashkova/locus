import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root: a parent directory also has a package-lock.json, which would
  // otherwise be inferred as the root and break file tracing on deploy.
  turbopack: {
    root: __dirname,
  },
  // Transformers.js (+ onnxruntime-node native binary) must load as a real node module in
  // serverless functions, not be bundled — otherwise the embedding model fails to load.
  serverExternalPackages: ["@huggingface/transformers"],
};

export default nextConfig;
