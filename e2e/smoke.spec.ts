import { test, expect } from "@playwright/test";

/**
 * Smoke tests — the thinnest end-to-end coverage that the app boots, routes, and serves its API
 * contract. Intentionally avoids LLM/quota-spending endpoints (Ask/Act/generate) and writes; those
 * belong in fuller flow specs. See `playwright.config.ts` for how to run.
 */

test("OpenAPI document is served and well-formed", async ({ request }) => {
  const res = await request.get("/api/openapi");
  expect(res.ok()).toBeTruthy();
  const spec = await res.json();
  expect(spec.openapi).toMatch(/^3\./); // OpenAPI 3.x
  // Every documented module endpoint should be present in the contract.
  expect(Object.keys(spec.paths)).toEqual(
    expect.arrayContaining(["/api/ask", "/api/act", "/api/generate", "/api/tracks", "/api/submissions"]),
  );
});

test("root redirects into the first module and the app shell renders", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/capture$/);
  // The shell shows navigation to all four modules.
  for (const label of [/capture/i, /ask/i, /act/i, /tracks/i]) {
    await expect(page.getByRole("link", { name: label }).first()).toBeVisible();
  }
});

test("saving a submission while signed out is rejected by the API", async ({ request }) => {
  // The write trust boundary: no session → 401, no row created. No LLM, no DB write.
  const res = await request.post("/api/submissions", {
    data: { jsonSchema: { title: "x", type: "object", properties: {} }, data: {} },
  });
  expect(res.status()).toBe(401);
});
