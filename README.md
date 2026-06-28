# Locus

> A geospatial workspace to **capture, ask, act on, and analyze** location data.
> One Next.js + **Postgres (PostGIS + pgvector)** app with four capabilities built as layered
> modules: schema-driven geo forms, a geospatial RAG assistant, an agent with map tools (MCP),
> and trajectory analytics.

**Live demo:** https://locus-dun.vercel.app · **Stack:** Next.js (App Router) · TypeScript · Postgres + PostGIS + pgvector (Supabase) · Drizzle · Vercel AI SDK (Gemini free / Ollama, provider-agnostic) · embeddings via the AI SDK (Gemini free) · MapLibre + OpenFreeMap · Turf.js · zero-dependency SVG charts · OpenAPI/Swagger

> **100% free stack** — no paid services. The LLM provider is a one-line swap via the AI SDK, so a
> paid model (e.g. Claude) can drop in later without rearchitecting. Full mapping in
> [`FREE_STACK.md`](./FREE_STACK.md).

---

## What it is

Most location work follows the same loop: **get data in, make sense of it, act on it, learn from
it.** Locus is one workspace that does all four over a single PostGIS database, so a team doing
field surveys, delivery ops, site selection, utilities or research can capture observations, ask
questions in plain language, run spatial actions through an agent, and analyze movement — without
five different tools.

It's deliberately domain-agnostic. The demo ships generic "sites and visits" data; the engine
doesn't care whether you're tracking storefronts, inspections, deliveries or trailheads.

## The four capabilities

| Module | What it does | Demonstrates |
| --- | --- | --- |
| **Capture** | Build data-entry forms from a plain-English description; location fields are real map widgets. | Structured LLM output (tool-calling), RJSF + AJV, Zod, GeoJSON |
| **Ask** | A geospatial RAG assistant over your data + open sources — cited answers *and* a map of mentioned places. | RAG, pgvector, hybrid search, reranking, evals |
| **Act** | An agent with geo tools (geocode, route, isochrone, nearby, weather) exposed over **MCP** and used in-app. | MCP server, agent orchestration, tool-calling, observability |
| **Tracks** | Import GPS trajectories, compute movement metrics, play them back, and get an AI briefing. | PostGIS geography analytics, stay-point stop detection, animated MapLibre playback + density heatmap, grounded LLM |

## Architecture

```
                         ┌──────────────────────────────────────────┐
                         │   Next.js (App Router) + TypeScript        │
                         │   MapLibre GL · Vercel AI SDK              │
                         └───────┬───────────┬───────────┬───────────┘
            Capture ─────────────┘           │           └───────────── Tracks
            (RJSF + geo widgets)             │                          (import → metrics → playback)
                         Ask ────────────────┤
                         (RAG + map)         │
                                       Act ──┘
                                       (in-app agent ⇄ Locus MCP server)
                         ┌──────────────────────────────────────────┐
                         │   Postgres                                 │
                         │   PostGIS (geometry) · pgvector (semantic) │
                         │   tsvector (keyword)                       │
                         └──────────────────────────────────────────┘
```

The whole app runs on **one datastore**: PostGIS for geometry, pgvector for semantic search,
tsvector for keyword search. No syncing between a vector DB and a geo DB — the single biggest
reason the four modules share a foundation instead of being four separate apps.

## Why one app, four modules

The stacks overlap almost completely — Next.js, Postgres, Vercel AI SDK, MapLibre, the evals
pattern — so the foundation is built **once** (Phase 0) and each capability is a vertical slice on
top. The result is one coherent product that's independently deployable at every phase, rather than
four toy repos.

## Key decisions

- **Single Postgres for spatial + semantic + keyword.** Simpler, cheaper, no sync; correct until
  ~10M vectors or a hard latency budget.
- **LLMs explain and structure; they never invent facts or numbers.** Generated form schemas are
  Zod-validated before use; RAG answers are grounded in retrieved text with citations; trip
  briefings are written *from* computed metrics passed in as facts.
- **MCP for the agent tools.** Writing them once as an MCP server means they work in-app *and* in
  Claude Desktop or any MCP client.
- **Open, no-key data and a free stack by default.** OSM (Nominatim/Overpass), OpenRouteService
  (free key), Open-Meteo, SunCalc, CC-licensed corpora; MapLibre on OpenFreeMap tiles (no key, no signup);
  Gemini free tier or local Ollama for the LLM with local in-process embeddings. The whole demo
  runs for anyone at zero cost — see [`FREE_STACK.md`](./FREE_STACK.md).
- **Evals are a first-class, cross-cutting concern**, not a per-feature afterthought (see below).

## Tests & evals

Two complementary layers:

- **Unit tests** (`npm test`, Vitest) cover the pure logic — trajectory metrics, stay-point stop
  detection, elevation hysteresis, GPX/GeoJSON parsing, the synthetic-track generator, activity
  presets, and marine routing — with hand-calculated worked examples. Fast, deterministic, no DB.
- **Eval harness** (`npm run eval`) exercises each module end-to-end (some steps hit the LLM):

| Module | Key metrics |
| --- | --- |
| Capture | schema_valid · field_coverage · conditional_ok · geo_format_ok |
| Ask | recall@k · faithfulness (LLM-as-judge) · geo_match · refusal_correct |
| Act | task_success · tool_choice · step_efficiency · no_hallucinated_tools |
| Tracks | metric formulas vs. hand-calculated worked examples |

## API

Every module is backed by a small HTTP API documented with **OpenAPI 3.0** and browsable with
**Swagger UI**:

- **Swagger UI:** [`/api/docs`](https://locus-dun.vercel.app/api/docs) — try endpoints in the browser.
- **OpenAPI spec:** [`/api/openapi`](https://locus-dun.vercel.app/api/openapi) (JSON).

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/health` | GET | DB + PostGIS/pgvector health |
| `/api/usage` | GET | Gemini free-tier quota left today |
| `/api/generate` | POST | Capture: prompt → form schema |
| `/api/submissions` | GET · POST | List / save Capture submissions |
| `/api/ask` | POST | Ask: grounded RAG answer (streaming) |
| `/api/act` | POST | Act: agent task (NDJSON stream) |
| `/api/geocode` | GET | Place typeahead (Photon/OSM) |
| `/api/tracks` | GET · POST | List tracks / import GPX·GeoJSON |
| `/api/tracks/{id}` | GET | Track fixes + segments |
| `/api/tracks/{id}/explain` | POST | Grounded trip briefing (streaming) |
| `/api/tracks/heatmap` | GET | Density-heatmap points (GeoJSON) |
| `/api/tracks/build` | POST | Build a track from a drawn route (boats routed by sea) |
| `/api/tracks/route-preview` | POST | Preview a route's geometry for an activity |

## Running locally

```bash
git clone <repo>
cd locus
cp .env.example .env.local            # GEMINI_API_KEY (or Ollama), DATABASE_URL (Supabase/Neon), ORS_API_KEY, LANGFUSE_* — all free, see FREE_STACK.md
docker compose up -d                  # Postgres + PostGIS + pgvector
npm install
npm run db:migrate
npm run seed                          # sample sites
npm run seed:tracks                   # synthetic GPS tracks for the Tracks module
npm run ingest                        # embed the corpus for Ask
npm run dev                           # http://localhost:3000
npm test                              # unit tests (Vitest) — no DB/LLM needed
npm run eval                          # cross-module eval suite
```

## Roadmap (build order)

- ✅ **Phase 0 — Foundation:** scaffold, PostGIS + pgvector, map shell, design system, evals skeleton. *Live.*
- ✅ **Phase 1 — Capture:** NL → JSON Schema → RJSF with `geo-point` / `geo-polygon` widgets. *Live.*
- ✅ **Phase 2 — Ask:** ingestion, hybrid + spatial retrieval, cited streaming answers + map. *Live.*
- ✅ **Phase 3 — Act:** Locus MCP server (geo tools) + in-app agent with Langfuse tracing. *Live.*
- ✅ **Phase 4 — Tracks:** GPX/GeoJSON import, PostGIS geography metrics + stay-point stop detection, animated MapLibre playback + density heatmap, custom SVG profiles, grounded "explain this trip." *Live.*

Each phase is independently demoable, so there's always something live: **https://locus-dun.vercel.app**

### Capture (Phase 1)

Describe a form in plain English at `/capture`. The configured LLM (Gemini free / Ollama, via the
Vercel AI SDK) emits a field list through one `emit_schema` tool; the result is Zod-guarded (retry
once on failure) and built into a JSON Schema, rendered with **RJSF + AJV (draft 2020-12)**. Location
fields are real map widgets — `geo-point` (click a MapLibre map) and `geo-polygon` (draw with
terra-draw, area via Turf) — producing GeoJSON. Submissions save to Postgres: the designated
geo-point creates or selects a `site` and the value is projected into a PostGIS `geometry(Point,4326)`
column. Evals (`npm run eval -- --module=capture`) cover `schema_valid`, `field_coverage`,
`conditional_ok`, and `geo_format_ok`.

### Ask (Phase 2)

Ask a question at `/ask` and get a **cited, grounded answer** plus a **map of the places it
mentions**. `npm run ingest` chunks an open corpus (Wikivoyage CC BY-SA, OSM ODbL) + your captured
`sites`/`submissions`, embeds them, and stores each chunk with three search modalities on one table:
**pgvector** (semantic, HNSW), **tsvector** (keyword, GIN), **PostGIS** (`geom`, GiST). A query runs
vector ∪ keyword search fused with reciprocal-rank fusion (+ optional `ST_DWithin` proximity), then
the answer is streamed grounded **only** in the retrieved chunks with `[n]` citations; out-of-corpus
questions are declined, not hallucinated. Cited places drop pins on the shared map. Answers respond
in the user's language. Embeddings run through the Vercel AI SDK (Gemini `gemini-embedding-001`,
768-d) so they work on serverless; the model is one swappable constant. Evals
(`npm run eval -- --module=ask`) cover `recall@k`, `geo_match`, and `refusal_correct`.

### Act (Phase 3)

Give a location task at `/act` (e.g. *"drive time from Kyiv to Lviv"*). An agent (Vercel AI SDK,
`streamText` + tool-calling, bounded steps) plans and calls **real geo tools** — geocode, route,
isochrone, nearby, weather, elevation, sun times — streaming its reasoning, the tools it picks, and
GeoJSON results onto the shared map. The same seven tools are exposed over a **stdio MCP server**
(`packages/locus-mcp`) so Claude Desktop can drive them too — one tool core, two surfaces. Runs are
traced with **Langfuse** (OpenTelemetry) and checked by evals (`task_success`, `tool_choice`,
`no_hallucinated_tools`, `step_efficiency`).

### Tracks (Phase 4)

Pick a sample track or import a **GPX/GeoJSON** file at `/tracks`. Everything downstream is computed
server-side and grounded:

- **PostGIS analytics.** Fixes are stored as `geography(Point,4326)` so distances are measured on
  the spheroid in metres; the path is a simplified `geometry(LineString)` (Douglas–Peucker) for
  rendering. A pure-TypeScript metrics service computes total/moving distance, moving vs. stopped
  time, average/max speed, and elevation gain/loss.
- **Stop detection** is a stay-point clustering (Li et al.) — a maximal run of fixes within a radius
  that spans a minimum dwell — *not* a speed threshold, so a slow crawl isn't a "stop" and a brief
  pause at a light isn't either. The track is split into alternating **move**/**stop** segments.
- **Animated playback** over the map: the marker is interpolated by *real elapsed time*, so it
  visibly lingers where the traveller dwelled. A scrubber + play/pause drive it; a multi-track
  **density heatmap** (native MapLibre) shows where many tracks overlap.
- **Charts** are dependency-free inline **SVG** — elevation and speed profiles over distance, plus a
  move/stop dwell timeline, all cursored to the playback head.
- **"Explain this trip"** streams a plain-language briefing from the LLM, handed the *computed*
  metrics as grounded facts and forbidden from doing arithmetic of its own.

Metrics are verified by evals against **hand-calculated worked examples**
(`npm run eval -- --module=tracks`): distance/speed, elevation gain/loss, and the stop-detection
min-dwell gate. Seed synthetic tracks with `npm run seed:tracks`.

## Engineering notes

- Building the foundation once (Phase 0) is what makes this a weekend-per-feature project instead
  of a month-per-app one.
- The hardest parts worth writing about: chunking for RAG quality, the agent calling `route`
  before geocoding (fixed with tool descriptions + planning, not a bigger model), and stop
  detection on noisy GPS (clustering + min-dwell, not a speed threshold).
