import "../../scripts/load-env";
import { suites } from "./index";
import { writeResults } from "./writer";
import type { EvalResult } from "./types";

// Usage: npm run eval [-- --module=foundation]
async function main() {
  const filter = process.argv.find((a) => a.startsWith("--module="))?.split("=")[1];
  const ts = new Date().toISOString().replace(/[:.]/g, "-");

  const results: EvalResult[] = [];
  let failed = 0;

  for (const suite of suites) {
    if (filter && suite.module !== filter) continue;
    console.log(`\n▶ ${suite.module} / ${suite.name}`);
    for (const c of suite.cases) {
      let checks;
      try {
        checks = await c.run();
      } catch (e) {
        checks = [{ metric: "run", pass: false, note: String(e) }];
      }
      for (const ch of checks) {
        results.push({ module: suite.module, suite: suite.name, case: c.name, ts, ...ch });
        if (!ch.pass) failed++;
        const icon = ch.pass ? "✓" : "✗";
        const score = ch.score !== undefined ? ` (${ch.score})` : "";
        const note = ch.note ? ` — ${ch.note}` : "";
        console.log(`  ${icon} ${c.name} · ${ch.metric}${score}${note}`);
      }
    }
  }

  const file = await writeResults(results, ts);
  const passed = results.length - failed;
  console.log(
    `\n${passed}/${results.length} checks passed · results → ${file.replace(process.cwd() + "/", "")}`,
  );
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
