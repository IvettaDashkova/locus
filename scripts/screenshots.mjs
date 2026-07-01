// Capture demo-mode screenshots for the README. Run against a live dev server:
//   npm run dev   (in another shell)
//   node scripts/screenshots.mjs [baseURL]
// Uses the demo buttons so every shot is deterministic, signed-out, and spends no AI budget.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.argv[2] || "http://localhost:3001";
const OUT = "docs/screenshots";
const VIEWPORT = { width: 1440, height: 900 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEWPORT, locale: "en-US", deviceScaleFactor: 2 });
  // Skip the once-per-browser onboarding tour — its full-screen backdrop would intercept clicks.
  await ctx.addInitScript(() => localStorage.setItem("locus:onboarding:v1", "1"));
  // Hide the Next.js dev-tools indicator (the "N / issues" badge) so README shots are clean. The host
  // element lives in the light DOM even though its UI is in shadow DOM, so hiding the host works.
  await ctx.addInitScript(() => {
    const css = "[data-nextjs-dev-overlay],nextjs-portal,[data-nextjs-toast],[data-next-badge-root]{display:none!important}";
    const apply = () => {
      const s = document.createElement("style");
      s.textContent = css;
      document.documentElement.appendChild(s);
    };
    if (document.documentElement) apply();
    else document.addEventListener("DOMContentLoaded", apply);
  });
  const page = await ctx.newPage();

  const shot = async (name) => {
    await page.screenshot({ path: `${OUT}/${name}.png` });
    console.log(`✓ ${name}.png`);
  };

  // ── Capture ──
  await page.goto(`${BASE}/capture`, { waitUntil: "networkidle" });
  await sleep(1500);
  await page.getByRole("button", { name: "New form" }).click();
  await sleep(600);
  await page.getByRole("button", { name: "View demo" }).click();
  await sleep(2500); // form render + geo widget map tiles
  await shot("capture");
  await page.keyboard.press("Escape");
  await sleep(500);

  // ── Ask ──
  await page.goto(`${BASE}/ask`, { waitUntil: "networkidle" });
  await sleep(1500);
  await page.getByRole("button", { name: "Ask" }).first().click();
  await sleep(600);
  await page.getByRole("button", { name: "View demo" }).click();
  await sleep(3000); // citations + map pins fit-bounds
  await shot("ask");

  // ── Act ──
  await page.goto(`${BASE}/act`, { waitUntil: "networkidle" });
  await sleep(1500);
  await page.getByRole("button", { name: "Act" }).first().click();
  await sleep(600);
  await page.getByRole("button", { name: "View demo" }).click();
  await sleep(3000); // route + endpoint pins on the map
  await shot("act");

  // ── Tracks ── (seeded tracks are public — pick the first and let playback render)
  // The Tracks map + heatmap stream continuously, so the network never goes idle — wait for DOM only.
  await page.goto(`${BASE}/tracks`, { waitUntil: "domcontentloaded" });
  // The list comes from a remote Postgres (Supabase pooler) that can take several seconds — wait for
  // the first track row to actually appear rather than a fixed delay, then open it.
  const firstTrack = page.locator("aside button").filter({ hasText: /·/ }).first();
  try {
    await firstTrack.waitFor({ state: "visible", timeout: 45000 });
    await firstTrack.click();
    await sleep(8000); // detail query + SVG charts + playhead render (remote DB is slow)
  } catch {
    console.warn("! no track row appeared in time — capturing the Tracks entry state instead");
    await sleep(2000);
  }
  await shot("tracks");

  await browser.close();
  console.log("done →", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
