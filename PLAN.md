# Locus — Phase 3 Plan · Act (agent + geo tools over MCP)

> An **agent** that orchestrates real geo tools — geocode, places nearby, route, isochrone,
> elevation, weather, sun times — to answer location tasks, **rendering each result on the map**.
> The tools are written once as a **Locus MCP server** (so they work in Claude Desktop / any MCP
> client) *and* surfaced in-app as Vercel AI SDK tools (Vercel can't host a long-running MCP
> process). The LLM plans and calls tools; it never invents coordinates, distances, or numbers — it
> reports what the tools return.
>
> Phase 0–2 plans archived in [`docs/plans/`](./docs/plans). Spec: [`README.md`](./README.md).
> **No code in this doc — design + open questions only.**

Builds on the foundation: `getModel()` (AI SDK), the shared `MapContext` + map layers, the Ask
slide-over UX, i18n, the `/evals` harness, `ORS_API_KEY` (already in env), and the reserved
`packages/locus-mcp/` workspace.

---

## 1. The seven tools (typed I/O · free source · cache + fixture)

All sources are free/open. Every tool: validate input (Zod) → check cache → call source (or replay a
fixture offline) → return typed output + a GeoJSON `feature(s)` field the map can render directly.

| Tool | Input | Output (+ GeoJSON) | Free source | Notes |
| --- | --- | --- | --- | --- |
| `geocode` | `{ query }` | `{ name, lat, lng }` → Point | **Nominatim** (OSM) | 1 req/s, `User-Agent` required; cache hard |
| `places_nearby` | `{ lat, lng, radiusM, category }` | `[{ name, lat, lng, tags }]` → Points | **Overpass** (OSM) | rate-limited; cache by cell+category |
| `route` | `{ from:[lng,lat], to:[lng,lat], profile }` | `{ distanceM, durationS, geometry }` → LineString | **OpenRouteService** (free key) | `ORS_API_KEY`; OSRM demo as dev fallback |
| `isochrone` | `{ lng, lat, minutes, profile }` | `{ polygons }` → Polygon | **OpenRouteService** (free key) | reachability area |
| `elevation` | `{ lat, lng }` | `{ elevationM }` | **Open-Meteo Elevation** | no key |
| `weather` | `{ lat, lng }` | `{ tempC, wind, code, … }` | **Open-Meteo** | no key |
| `sun_times` | `{ lat, lng, date? }` | `{ sunrise, sunset, goldenHour, … }` | **SunCalc** (local) | no API at all |

- **Cache:** a small key→value store with TTL. Default in-process LRU; optionally a `tool_cache`
  table (key, response jsonb, expires_at) so it survives serverless cold starts and respects OSM
  usage policy. Cache keys round coordinates to a grid so nearby calls reuse results.
- **Fixtures:** each tool ships a recorded sample response under `fixtures/` so the demo (and evals)
  run fully offline / when a source is down. A `LOCUS_TOOLS_OFFLINE=1` flag forces fixtures.
- **Respect OSM policy:** low volume, cache results, set a descriptive `User-Agent`. Not for bulk use.

---

## 2. One tool implementation, two entry points

The tool logic lives once in **`packages/locus-mcp/src/tools/*`** (pure functions: `(input) =>
output`, with their Zod schemas, cache, and fixtures). Two thin adapters expose them:

1. **Standalone MCP server** (`packages/locus-mcp`, TypeScript MCP SDK) — `npm run mcp`. A
   long-running stdio process for **Claude Desktop** and any MCP client. Documented in
   `docs/claude-desktop.md`.
2. **In-app AI SDK tools** (`src/lib/act/tools.ts`) — the same functions wrapped as AI SDK `tool({
   inputSchema, execute })` for the hosted agent. (Vercel can't host the MCP process, so the hosted
   demo calls the shared functions directly — same code, no MCP transport.)

This is the "write the geo tools once, run them in-app *and* in Claude Desktop" story.

---

## 3. The in-app agent (`/api/act`, streaming)

- `POST /api/act` (nodejs, `maxDuration` bumped — multiple tool round-trips + LLM steps).
- AI SDK multi-step agent: `streamText({ model: getModel(), tools, stopWhen: stepCountIs(N) })` —
  **plan → call tool → observe result → iterate** until the task is done, streaming the reasoning,
  tool calls, and final answer.
- **System prompt** enforces grounding: use tools for every fact/coordinate/number; never invent;
  prefer `geocode` before `route`/`isochrone` (the classic "route before geocode" bug — fixed with
  clear tool descriptions + a planning instruction, not a bigger model); state assumptions.
- **Tool results stream to the UI** as structured events so the map updates live (a pin appears when
  `geocode` returns, a line when `route` returns, a polygon for `isochrone`).
- **Human-in-the-loop:** read-only tools (all seven here) run autonomously; the loop is built so a
  *consequential* tool (e.g. a future "save"/"send") would pause for confirmation before executing —
  the gate is in place even though Phase-3 tools don't need it.

---

## 4. Map rendering

Tool outputs carry GeoJSON, so a single **Act results layer** (reuse the `MapContext` + the
submissions/ask layer pattern) renders points (geocode/places), lines (route), and polygons
(isochrone), with hover tooltips (tool + value) and fit-to-bounds. The agent's "show me" results
accumulate on the map for the session; a clear control resets them.

**UI:** the **Act** module mirrors Ask — an "Act" button opens a left slide-over agent chat
(non-modal, map stays live); map controls sit bottom-right; i18n throughout. The transcript shows
the agent's tool calls (e.g. `geocode("Kyiv") → 50.45, 30.52`) and the final grounded answer.

---

## 5. Observability — Langfuse

Wrap the agent run with **Langfuse** (free tier; keys already in env, no-op if unset): trace each
step — tool name, input, output, latency, token cost, errors — with a link to the trace in the UI.
This is the "show I can instrument an agent" story. The AI SDK's telemetry hooks feed Langfuse.

---

## 6. Act eval suite (`src/evals/suites/act.*`)

Registered in the `/evals` registry (metric names reserved). ~10 scenarios, run against fixtures so
they're deterministic and offline:

| Metric | Check |
| --- | --- |
| `task_success` | the final answer/result matches the expected outcome (e.g. correct city, plausible route) |
| `tool_choice` | the right tools are called for the task (geocode for a place, route for "how far") |
| `step_efficiency` | the task is solved within an expected step budget (no aimless looping) |
| `no_hallucinated_tools` | the agent only calls defined tools; coordinates/numbers come from tool output |

Scenarios mix single-tool ("what's the weather in Lviv" → geocode→weather) and multi-tool ("drive
time from Kyiv to Lviv" → geocode×2→route). Offline-tolerant on free-tier LLM limits.

---

## 7. New dependencies (all free / open-source)

`@modelcontextprotocol/sdk` (the MCP server), `suncalc` (+ `@types/suncalc`), optional `langfuse`.
Routing/geocoding/weather are plain `fetch` to free endpoints — no SDKs. No paid APIs.

---

## 8. Build order (playbook 3.2 → 3.4)

1. **MCP server + tools** — `packages/locus-mcp` with the seven typed tools (cache + fixtures);
   `npm run mcp`; test each tool in isolation.
2. **In-app agent + map** — `src/lib/act/tools.ts` (AI SDK wrappers), `/api/act` streaming agent,
   Act slide-over UI rendering points/routes/isochrones on the map; HITL gate for consequential steps.
3. **Observability + evals + deploy** — Langfuse tracing (UI link), Act evals (~10), `docs/claude-
   desktop.md`, deploy, README Act section.

**Definition of done:** ask the agent a location task → it plans, calls real tools, streams the
reasoning, renders results on the map, and answers grounded in tool output; the same tools run in
Claude Desktop via the MCP server; `npm run eval -- --module=act` passes; live on `locus-dun`.

---

## 9. Open questions

1. **Routing source — ORS vs OSRM?** Default **OpenRouteService** (we already have `ORS_API_KEY`,
   and it covers **both** route *and* isochrone). OSRM public demo only as a dev fallback. OK?
2. **Tool cache — in-process only, or a `tool_cache` DB table?** Default: **in-process LRU + fixtures
   first**, add the DB table only if rate limits bite during the demo. (DB cache is the only
   schema-touching choice here — confirm before any migration.)
3. **MCP server now, or in-app agent first?** Both ship in Phase 3, but which first? Default: **build
   the shared tools + in-app agent first** (that's the live demo), then wrap the standalone MCP
   server for Claude Desktop. Agree?
4. **Agent step budget.** Default `stopWhen: stepCountIs(8)` — enough for multi-tool tasks, bounded
   against runaway loops. Tune in evals.
5. **Act UI.** Default: same slide-over pattern as Ask (consistent). Keep it, or a different layout
   for the agent transcript?
6. **HITL depth.** Phase-3 tools are read-only, so confirmation is a built-in *gate* that nothing
   triggers yet. Implement the gate now (future-proof) or defer until a consequential tool exists?
   Default: **implement the gate, no blocking prompts for the read-only tools.**
