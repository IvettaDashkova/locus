// Manual browser verification for Capture (Playwright). Requires the dev server running.
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

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  log("screenshot:", name);
}

async function fillRequired() {
  // Fill text-ish inputs and pick first real option for selects so RJSF "required" is satisfied.
  const inputs = page.locator(".locus-form input");
  const n = await inputs.count();
  for (let i = 0; i < n; i++) {
    const el = inputs.nth(i);
    const type = (await el.getAttribute("type")) || "text";
    if (["checkbox", "radio", "file"].includes(type)) continue;
    if (type === "number") await el.fill("3");
    else if (type === "url") await el.fill("https://example.com/photo.jpg");
    else if (type === "email") await el.fill("inspector@example.com");
    else await el.fill("Verify Harbor Office");
  }
  const selects = page.locator(".locus-form select");
  const sn = await selects.count();
  for (let i = 0; i < sn; i++) {
    const opts = await selects.nth(i).locator("option").all();
    for (const o of opts) {
      const v = await o.getAttribute("value");
      if (v) { await selects.nth(i).selectOption(v); break; }
    }
  }
}

try {
  // 1) initial
  await page.goto(`${BASE}/capture`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("textarea", { timeout: 20000 });
  await page.waitForTimeout(2500); // let the shell map paint
  log("loaded /capture; prompt textarea present:", await page.locator("textarea").first().isVisible());
  await shot("01-initial");

  // 2) generate a survey form
  await page.getByRole("button", { name: "Example 1" }).click();
  log("prompt:", (await page.locator("textarea").first().inputValue()).slice(0, 70), "...");
  await page.getByRole("button", { name: "Generate form" }).click();
  log("clicked Generate; waiting for form to render…");
  await page.waitForSelector(".locus-form input, .locus-form select", { timeout: 80000 });
  await page.waitForTimeout(1500);
  const inspectorLen = (await page.locator("textarea").nth(1).inputValue()).length;
  log("inspector populated, chars:", inspectorLen);
  log("form fields:", await page.locator(".locus-form label").allInnerTexts());
  await shot("02-generated");

  // 3) + 4) geo-point: click the embedded map
  const mapCanvas = page.locator(".locus-form canvas.maplibregl-canvas").first();
  await mapCanvas.waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(2500); // map tiles load
  const box = await mapCanvas.boundingBox();
  await mapCanvas.click({ position: { x: Math.round(box.width / 2), y: Math.round(box.height / 2) } });
  await page.waitForTimeout(1500);
  const coordText = await page.locator(".locus-form").getByText(/lng .*lat/i).first().innerText().catch(() => "(no coord text)");
  log("after map click, coord text:", coordText);
  await shot("03-point");

  // 5) fill required + save
  await fillRequired();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Save submission" }).click();
  log("clicked Save; waiting for result…");
  const saved = page.getByText(/Saved/i).first();
  await saved.waitFor({ timeout: 20000 }).catch(() => {});
  const savedText = await saved.innerText().catch(() => "(no saved message)");
  const errText = await page.getByText(/match the schema|failed|error/i).first().innerText().catch(() => null);
  log("save result:", savedText, errText ? `| error: ${errText}` : "");
  await shot("04-saved");

  // 6) polygon flow
  await page.locator("textarea").first().fill(
    "A land parcel record: parcel id, owner, land use, and draw the boundary area on a map.",
  );
  await page.getByRole("button", { name: "Generate form" }).click();
  log("clicked Generate (polygon); waiting…");
  await page.waitForTimeout(2000);
  await page.waitForSelector(".locus-form canvas.maplibregl-canvas", { timeout: 80000 });
  await page.waitForTimeout(2500);
  const polyHint = await page.getByText(/add points|close|Area:/i).first().innerText().catch(() => "(no polygon hint)");
  log("polygon widget hint:", polyHint);
  await shot("05-polygon-form");

  // draw a polygon: 4 clicks + close on first
  const polyCanvas = page.locator(".locus-form canvas.maplibregl-canvas").first();
  const pb = await polyCanvas.boundingBox();
  const pts = [
    [pb.width * 0.4, pb.height * 0.35],
    [pb.width * 0.6, pb.height * 0.35],
    [pb.width * 0.6, pb.height * 0.6],
    [pb.width * 0.4, pb.height * 0.6],
  ];
  for (const [x, y] of pts) {
    await polyCanvas.click({ position: { x: Math.round(x), y: Math.round(y) } });
    await page.waitForTimeout(400);
  }
  await polyCanvas.click({ position: { x: Math.round(pts[0][0]), y: Math.round(pts[0][1]) } }); // close
  await page.waitForTimeout(1500);
  const areaText = await page.getByText(/Area:/i).first().innerText().catch(() => "(no area yet)");
  log("after drawing, area text:", areaText);
  await shot("06-polygon-drawn");

  console.log("\nVERIFY_RESULT: OK");
} catch (e) {
  console.log("\nVERIFY_RESULT: ERROR", e.message);
  await shot("99-error");
} finally {
  await browser.close();
}