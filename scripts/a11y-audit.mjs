/**
 * Accessibility audit of the module pages with axe-core (WCAG 2.0/2.1 A + AA). Runs a real Chromium
 * with software WebGL (SwiftShader) so MapLibre initializes and the map-overlay UI actually renders —
 * plain headless Chromium can't create a WebGL context, which degrades the page and hides real state.
 * Needs the app running (defaults to http://localhost:3000). Exits non-zero on any violation.
 *   npm run dev   # in one terminal
 *   npm run a11y
 */
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const PAGES = ["/capture", "/ask", "/act", "/tracks", "/lab"];

// SwiftShader gives headless Chromium a software WebGL context so MapLibre actually initializes and
// the module UI (which mounts over the map) renders — otherwise the page degrades and axe sees noise.
const browser = await chromium.launch({
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
  ],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

const summary = {};
for (const path of PAGES) {
  await page.goto(BASE + path, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(2500); // let the map + overlay settle
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const v = results.violations;
  summary[path] = v.length;
  console.log(`\n===== ${path} — ${v.length} violation type(s) =====`);
  for (const it of v) {
    console.log(`  [${it.impact}] ${it.id} — ${it.help}  (${it.nodes.length} node${it.nodes.length > 1 ? "s" : ""})`);
    for (const node of it.nodes.slice(0, 3)) {
      console.log(`      → ${node.target.join(" ")}`);
      console.log(`        ${node.html.slice(0, 120).replace(/\n/g, " ")}`);
    }
  }
}
console.log("\n===== SUMMARY =====");
for (const [p, n] of Object.entries(summary)) console.log(`  ${p.padEnd(12)} ${n} violation type(s)`);
await browser.close();

// Non-zero exit if any page has violations, so this can gate CI.
const total = Object.values(summary).reduce((a, b) => a + b, 0);
process.exit(total > 0 ? 1 : 0);
