import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Unit tests for the pure, dependency-light logic (mostly `src/lib/tracks/*`). Node environment, no
 * DB/network — these run fast and deterministically. The `@/` alias mirrors tsconfig paths. Native
 * node_modules stay external (Vitest's default for the node environment), so searoute-js loads the
 * same way it does at runtime.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
