// Manual browser verification for the Capture workspace (Playwright). Requires the dev server running.
// Usage: node scripts/verify-capture.mjs  → screenshots in /tmp/verify-capture/
import { chromium } from "playwright";

const OUT = "/tmp/verify-capture";
const BASE = "http://localhost:3000";
const log = (...a) => console.log("•", ...a);

const browser = await chromium.launch({
  headless: true,
  args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

const shot = async (n) => { await page.screenshot({ path: `${OUT}/${n}.png` }); log("screenshot:", n); };

async function fillRequired() {
  const inputs = page.locator(".locus-form input");
  for (let i = 0; i < (await inputs.count()); i++) {
    const el = inputs.nth(i);
    const type = (await el.getAttribute("type")) || "text";
    if (["checkbox", "radio", "file"].includes(type)) continue;
    await el.fill(type === "number" ? "3" : type === "url" ? "https://example.com/p.jpg" : type === "email" ? "a@b.co" : "Verify Harbor Office");
  }
  const selects = page.locator(".locus-form select");
  for (let i = 0; i < (await selects.count()); i++) {
    for (const o of await selects.nth(i).locator("option").all()) {
      const v = await o.getAttribute("value");
      if (v) { await selects.nth(i).selectOption(v); break; }
    }
  }
}

try {
  await page.goto(`${BASE}/capture`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "New form" }).waitFor({ timeout: 20000 });
  await page.waitForTimeout(2500);
  log("loaded; list count:", await page.locator("aside li").count());
  await shot("01-initial");

  await page.getByRole("button", { name: "New form" }).click();
  await page.waitForTimeout(800);
  log("studio open; textarea visible:", await page.locator("textarea").first().isVisible());
  await shot("02-studio");

  await page.getByRole("button", { name: /Example 1/ }).click();
  await page.getByRole("button", { name: "Generate form" }).click();
  log("generating…");
  await page.waitForSelector(".locus-form input, .locus-form select", { timeout: 80000 });
  await page.waitForTimeout(1500);
  log("form fields:", await page.locator(".locus-form label").allInnerTexts());
  await shot("03-generated");

  const canvas = page.locator(".locus-form canvas.maplibregl-canvas").first();
  await canvas.waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(2500);
  const box = await canvas.boundingBox();
  await canvas.click({ position: { x: Math.round(box.width / 2), y: Math.round(box.height / 2) } });
  await page.waitForTimeout(1200);
  log("coord text:", await page.locator(".locus-form").getByText(/lng .*lat/i).first().innerText().catch(() => "(none)"));
  await fillRequired();
  await shot("04-point");

  await page.getByRole("button", { name: "Save submission" }).click();
  log("saving…");
  await page.locator("aside li").first().waitFor({ timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  log("after save — list count:", await page.locator("aside li").count(), "| studio closed:", !(await page.locator("textarea").first().isVisible().catch(() => false)));
  await shot("05-saved-list");

  await page.locator("aside li button").first().click();
  await page.waitForTimeout(1000);
  log("detail dialog:", (await page.getByRole("dialog").innerText().catch(() => "(no dialog)")).replace(/\n+/g, " | ").slice(0, 160));
  await shot("06-detail");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);

  await page.getByRole("button", { name: "Language" }).click();
  await page.waitForTimeout(400);
  await page.getByText("Українська").click();
  await page.waitForTimeout(600);
  const navText = await page.locator("aside nav").first().innerText().catch(() => "");
  log("nav after switch to UK:", navText.replace(/\n+/g, " / "));
  await shot("07-lang-uk");

  console.log("\nVERIFY_RESULT: OK");
} catch (e) {
  console.log("\nVERIFY_RESULT: ERROR", e.message);
  await shot("99-error");
} finally {
  await browser.close();
}
