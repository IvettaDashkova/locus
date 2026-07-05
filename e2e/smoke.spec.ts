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

test("the public landing page renders for signed-out visitors", async ({ page }) => {
  // Signed-out `/` is the portfolio landing (who I am + what Locus is + a way in), not a redirect.
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /ivetta dashkova/i })).toBeVisible();
  // A clear way into the app is present.
  await expect(page.getByRole("link", { name: /capture|explore|open|locus/i }).first()).toBeVisible();
});

test("saving a submission while signed out is rejected by the API", async ({ request }) => {
  // The write trust boundary: no session → 401, no row created. No LLM, no DB write.
  const res = await request.post("/api/submissions", {
    data: { jsonSchema: { title: "x", type: "object", properties: {} }, data: {} },
  });
  expect(res.status()).toBe(401);
});

test("a malformed track id is a 400, not a 500", async ({ request }) => {
  // Regression guard: a non-UUID path param must not reach the uuid column and throw.
  expect((await request.get("/api/tracks/not-a-uuid")).status()).toBe(400);
  // A well-formed but absent id is a clean 404.
  expect((await request.get("/api/tracks/00000000-0000-4000-8000-000000000000")).status()).toBe(404);
});

test("robots.txt and sitemap.xml are served for crawlers", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBeTruthy();
  expect(await robots.text()).toContain("Sitemap");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBeTruthy();
  const xml = await sitemap.text();
  for (const path of ["/ask", "/act", "/tracks", "/capture", "/lab"]) {
    expect(xml).toContain(path);
  }
});

test("the Navigation Lab renders (offline, no map/WebGL dependency)", async ({ page }) => {
  await page.goto("/lab");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("SEO surfaces: structured data, manifest, and a real 404", async ({ request }) => {
  // JSON-LD structured data on the landing page.
  const home = await (await request.get("/")).text();
  expect(home).toContain("application/ld+json");
  expect(home).toContain('"@type":"WebApplication"');

  // Installable web manifest.
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBeTruthy();
  expect((await manifest.json()).name).toContain("Locus");

  // Unknown routes return a real 404 (not a soft 200).
  expect((await request.get("/definitely-not-a-page")).status()).toBe(404);
});
