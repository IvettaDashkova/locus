import "./load-env";
import { TOOLS, type ToolRun } from "@/lib/act/tools";

/** Test a geo tool: `npm run act:try geocode '{"query":"Kyiv"}'`. */
async function main() {
  const [name, ...rest] = process.argv.slice(2);
  const t = TOOLS.find((x) => x.name === name);
  if (!t) {
    console.log("tools:", TOOLS.map((x) => x.name).join(", "));
    process.exit(0);
  }
  const raw = rest.length ? JSON.parse(rest.join(" ")) : {};
  const input = (t.inputSchema as { parse: (v: unknown) => unknown }).parse(raw); // apply zod defaults
  const r = await (t.run as (i: unknown) => Promise<ToolRun>)(input);
  console.log("summary :", r.summary);
  console.log("data    :", JSON.stringify(r.data).slice(0, 200));
  console.log("features:", r.features.length, r.features.map((f) => f.geometry.type).join(", "));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
