import { z } from "zod";
import { tool, type ToolSet } from "ai";
import { TOOLS, type ToolRun } from "./tools-core";

export { TOOLS } from "./tools-core";
export type { ToolRun } from "./tools-core";

/** Wrap the shared geo tools as Vercel AI SDK tools, collecting GeoJSON features for the map. */
export function aiTools(collect: (features: GeoJSON.Feature[]) => void): ToolSet {
  const out: ToolSet = {};
  for (const t of TOOLS) {
    out[t.name] = tool({
      description: t.description,
      inputSchema: t.inputSchema as z.ZodTypeAny,
      execute: async (input: unknown) => {
        const r = await (t.run as (i: unknown) => Promise<ToolRun>)(input);
        if (r.features.length) collect(r.features);
        return { summary: r.summary, ...r.data };
      },
    });
  }
  return out;
}
