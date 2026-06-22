# Locus

> A geospatial workspace to **capture, ask, act on, and analyze** location data.
> One Next.js + **Postgres (PostGIS + pgvector)** app with four capabilities built as layered
> modules: schema-driven geo forms, a geospatial RAG assistant, an agent with map tools (MCP),
> and trajectory analytics.

**Live demo:** _add URL_ · **Stack:** Next.js (App Router) · TypeScript · Postgres + PostGIS + pgvector (Supabase) · Drizzle · Vercel AI SDK (Gemini free / Ollama, provider-agnostic) · local embeddings (Transformers.js) · MapLibre + OpenFreeMap · Deck.gl · Turf.js · Highcharts

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
| **Tracks** | Import GPS trajectories, compute movement metrics, play them back, and get an AI briefing. | PostGIS spatial analytics, Deck.gl, data-viz, grounded LLM |

## Architecture

```
                         ┌──────────────────────────────────────────┐
                         │   Next.js (App Router) + TypeScript        │
                         │   MapLibre / Deck.gl · Vercel AI SDK       │
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

## Evals

A shared eval harness (`/evals`) covers each module:

| Module | Key metrics |
| --- | --- |
| Capture | schema_valid · field_coverage · conditional_ok · geo_format_ok |
| Ask | recall@k · faithfulness (LLM-as-judge) · geo_match · refusal_correct |
| Act | task_success · tool_choice · step_efficiency · no_hallucinated_tools |
| Tracks | metric formulas vs. hand-calculated worked examples |

## Running locally

```bash
git clone <repo>
cd locus
cp .env.example .env.local            # GEMINI_API_KEY (or Ollama), DATABASE_URL (Supabase/Neon), ORS_API_KEY, LANGFUSE_* — all free, see FREE_STACK.md
docker compose up -d                  # Postgres + PostGIS + pgvector
npm install
npm run db:migrate
npm run seed                          # sample sites, corpus, tracks
npm run dev                           # http://localhost:3000
npm run eval                          # cross-module eval suite
```

## Roadmap (build order)

- **Phase 0 — Foundation:** scaffold, PostGIS + pgvector, map shell, design system, evals skeleton.
- **Phase 1 — Capture:** NL → JSON Schema → RJSF with `geo-point` / `geo-polygon` widgets. *Deploy.*
- **Phase 2 — Ask:** ingestion, hybrid + spatial retrieval, cited streaming answers + map. *Deploy.*
- **Phase 3 — Act:** Locus MCP server (geo tools) + in-app agent with Langfuse tracing. *Deploy.*
- **Phase 4 — Tracks:** GPX/GeoJSON import, PostGIS metrics, Deck.gl playback, "explain this trip." *Deploy.*

Each phase is independently demoable, so there's always something live.

## Engineering notes

- Building the foundation once (Phase 0) is what makes this a weekend-per-feature project instead
  of a month-per-app one.
- The hardest parts worth writing about: chunking for RAG quality, the agent calling `route`
  before geocoding (fixed with tool descriptions + planning, not a bigger model), and stop
  detection on noisy GPS (clustering + min-dwell, not a speed threshold).
