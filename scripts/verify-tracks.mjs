// Manual browser verification for the Tracks workspace (Playwright). Requires the dev server running.
// Usage: node scripts/verify-tracks.mjs  → screenshots in /tmp/verify-tracks/
import { chromium } from "playwright";

const OUT = "/tmp/verify-tracks";
const BASE = process.env.BASE || "http://localhost:3737";
const log = (...a) => console.log("•", ...a);

const browser = await chromium.launch({
  headless: true,
  args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

const shot = async (n) => { await page.screenshot({ path: `${OUT}/${n}.png` }); log("screenshot:", n); };

try {
  await page.goto(`${BASE}/tracks`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Import track" }).waitFor({ timeout: 20000 });
  await page.waitForTimeout(2500);
  const cards = page.locator("aside button");
  log("loaded; sidebar buttons:", await cards.count());
  await shot("01-list");

  // Toggle heatmap on the overview.
  await page.getByRole("button", { name: "Heatmap" }).click();
  await page.waitForTimeout(1500);
  await shot("02-heatmap");
  await page.getByRole("button", { name: "Heatmap" }).click();
  await page.waitForTimeout(500);

  // Select the Ridge hike (has rich elevation).
  await page.getByText("Ridge trail hike").click();
  await page.waitForTimeout(2500);
  log("selected track; charts svg count:", await page.locator("aside svg").count());
  await shot("03-detail");

  // Play the trajectory; capture the moving marker mid-way.
  await page.getByRole("button", { name: "Play" }).click();
  await page.waitForTimeout(6000);
  await shot("04-playback");

  // Seek the scrubber to ~70%.
  const slider = page.locator('input[type="range"]');
  await slider.evaluate((el) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, "0.7");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForTimeout(1500);
  await shot("05-seek");

  // Back to the list, select the Kyiv walk to confirm multiple tracks render.
  await page.getByRole("button", { name: "All tracks" }).click();
  await page.waitForTimeout(800);
  await page.getByText("Kyiv old town walk").click();
  await page.waitForTimeout(2500);
  await shot("06-kyiv");

  log("done");
} catch (e) {
  console.error("FAILED:", e.message);
  await shot("error");
  process.exitCode = 1;
} finally {
  await browser.close();
}
