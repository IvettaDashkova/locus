# Using the Locus MCP server in Claude Desktop

The **Locus MCP server** exposes the seven Locus geo tools over stdio, so Claude Desktop (or any MCP
client) can call them: `geocode`, `places_nearby`, `route`, `isochrone`, `elevation`, `weather`,
`sun_times`. It runs the **same tool code** as the in-app Act agent (`src/lib/act/tools-core.ts`).

## Setup

1. (Optional) Get a free **OpenRouteService** key for `route` / `isochrone`:
   https://openrouteservice.org/dev/#/signup — the other tools (OSM, Open-Meteo, SunCalc) need no key.
2. Add the server to your Claude Desktop config —
   `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) /
   `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

   ```json
   {
     "mcpServers": {
       "locus": {
         "command": "npx",
         "args": ["tsx", "/ABSOLUTE/PATH/TO/locus/packages/locus-mcp/src/server.ts"],
         "env": { "ORS_API_KEY": "your-openrouteservice-key" }
       }
     }
   }
   ```
3. Restart Claude Desktop. Ask, e.g.:
   - "What's the drive time from Kyiv to Lviv?" → `geocode` ×2 → `route`
   - "Cafés within 500 m of the Eiffel Tower?" → `geocode` → `places_nearby`
   - "Sunrise and weather in Lviv today?" → `geocode` → `sun_times` + `weather`

## Run it directly

```bash
npm run mcp          # stdio server; ORS_API_KEY from the environment for route/isochrone
```

The tools are read-only. Respect OSM/ORS usage policies — keep volume low; results are cached.
