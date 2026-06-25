# @locus/mcp

The **Locus MCP server**: the seven Locus geo tools (geocode, places_nearby, route, isochrone,
elevation, weather, sun_times) exposed over stdio for **Claude Desktop** and any MCP client.

It runs the **same tool code** as the in-app Act agent — `src/lib/act/tools-core.ts` (one
implementation, two entry points). `route`/`isochrone` need `ORS_API_KEY`; the rest need no key.

```bash
npm run mcp          # from the repo root
```

Claude Desktop setup: [`docs/claude-desktop.md`](../../docs/claude-desktop.md).
