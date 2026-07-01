// Focused Tracks screenshot — opens a seeded track and captures the detail (metrics + SVG charts +
// playback). Split out from screenshots.mjs because the Tracks list comes from a remote Postgres that
// can be slow/flaky, so this one retries the navigation. Usage: node scripts/screenshot-tracks.mjs [baseURL]
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.argv[2] || "http://localhost:3002";
const OUT = "docs/screenshots";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "en-US", deviceScaleFactor: 2 });
  await ctx.addInitScript(() => localStorage.setItem("locus:onboarding:v1", "1"));
  await ctx.addInitScript(() => {
    const s = document.createElement("style");
    s.textContent = "[data-nextjs-dev-overlay],nextjs-portal,[data-nextjs-toast],[data-next-badge-root]{display:none!important}";
    (document.documentElement || document).appendChild(s);
  });
  const page = await ctx.newPage();

  // Warm this browser context's own connection to the (slow, remote) API before the page's client
  // fetch races the map + heatmap for a pooler slot.
  try {
    const warm = await page.request.get(`${BASE}/api/tracks`, { timeout: 40000 });
    console.log("warm /api/tracks:", warm.status());
  } catch (e) {
    console.log("warm failed:", e.message);
  }

  const row = page.locator("aside button").filter({ hasText: /·/ }).first();
  let ok = false;
  for (let attempt = 1; attempt <= 5 && !ok; attempt++) {
    console.log(`attempt ${attempt}: goto /tracks`);
    await page.goto(`${BASE}/tracks`, { waitUntil: "domcontentloaded" });
    try {
      await row.waitFor({ state: "visible", timeout: 45000 });
      ok = true;
    } catch {
      console.log("  no rows yet — reloading");
    }
  }
  if (!ok) throw new Error("tracks never loaded");

  await row.click();
  await sleep(9000); // detail query + charts + playhead render (remote DB is slow)
  await page.screenshot({ path: `${OUT}/tracks.png` });
  console.log("✓ tracks.png");
  await browser.close();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
