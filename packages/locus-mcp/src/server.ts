import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { z } from "zod";
import { TOOLS, type ToolRun } from "../../../src/lib/act/tools-core";

/**
 * Locus MCP server — exposes the seven Locus geo tools (the SAME `run` functions used by the in-app
 * agent) over stdio, so they work in Claude Desktop or any MCP client. Needs `ORS_API_KEY` in the
 * environment for route/isochrone. Run: `npm run mcp`. See docs/claude-desktop.md.
 */
async function main() {
  const server = new McpServer({ name: "locus", version: "1.0.0" });

  for (const t of TOOLS) {
    server.registerTool(
      t.name,
      { description: t.description, inputSchema: (t.inputSchema as z.ZodObject<z.ZodRawShape>).shape },
      async (args: unknown) => {
        // Parse through the Zod schema so defaults/coercion are applied exactly as in the in-app
        // agent path — otherwise `run` receives raw args and Zod defaults (e.g. radiusM) are missing.
        const input = (t.inputSchema as z.ZodTypeAny).parse(args);
        const r = await (t.run as (i: unknown) => Promise<ToolRun>)(input);
        return { content: [{ type: "text" as const, text: `${r.summary}\n\n${JSON.stringify(r.data, null, 2)}` }] };
      },
    );
  }

  await server.connect(new StdioServerTransport());
  console.error(`Locus MCP server ready — ${TOOLS.length} tools over stdio`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
