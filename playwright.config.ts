import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end smoke harness. Separate from the Vitest unit suite (`npm test`, which only globs
 * `src/**​/*.test.ts`): these specs live under `e2e/` and drive a real browser against a running app.
 *
 * They need the full stack up — a reachable `DATABASE_URL`, env, and the dev server — so they are an
 * opt-in `npm run test:e2e`, not part of CI's `npm test`. First run locally:
 *   npm install            # pulls @playwright/test
 *   npx playwright install chromium
 *   npm run test:e2e
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/api/openapi",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
