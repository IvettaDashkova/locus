# Locus — Build Playbook (Claude Code)

One app, built as a shared foundation plus four feature phases in order of complexity. Each phase
follows plan → build → review → **deploy**, so something is always live. Run prompts one at a time
and review each output before sending the next.

What makes this go fast:
- **Always start each phase with its PLAN prompt** and read `PLAN.md` before building.
- Build the foundation **once** in Phase 0 — every later phase reuses it.
- Keep each build prompt to one vertical slice that runs end to end. Commit after each.
- The repo `README.md` is the spec — paste it in first.

Positioning: this is a universal geospatial product on purpose. Your maritime depth stays in your
work history; Locus broadens you into general geospatial so you match a far wider set of roles.

**Stack is 100% free** — Gemini free tier (or local Ollama) via the AI SDK, local embeddings,
Supabase/Neon Postgres, Vercel Hobby, MapLibre + OpenFreeMap, OSM/Open-Meteo tools, Langfuse free.
Full mapping, limits and signups in `FREE_STACK.md`. Read it before Phase 0.

Time: Phase 0 ~2–3 days · P1 ~3–5 days · P2 ~1–2 weeks · P3 ~1.5–2 weeks · P4 ~2–3 weeks.

---

## Phase 0 · Foundation  (~2–3 days)

**Prompt 0.1 — Plan**
```
Read README.md. We're building Locus, one Next.js app with four feature modules over a single
Postgres (PostGIS + pgvector) database. Phase 0 is the shared foundation only. Produce PLAN.md:
- monorepo/app structure for Next.js (App Router) + TypeScript
- docker-compose Postgres with postgis AND pgvector extensions
- Drizzle setup + base migrations (a `sites` table with PostGIS geometry to anchor everything)
- map shell (MapLibre GL + **OpenFreeMap** tiles — no key, no signup:
  `style: "https://tiles.openfreemap.org/styles/liberty"`; Protomaps `.pmtiles` or OSM raster as
  later options if you want self-hosted/offline)
- design system (Tailwind + shadcn/ui), app layout with a left module nav (Capture/Ask/Act/Tracks)
- a shared /evals skeleton (runner + results writer) the modules will plug into
- .env.example with GEMINI_API_KEY (or local Ollama), DATABASE_URL (Supabase/Neon free), ORS_API_KEY, LANGFUSE_* — all free
- LLM provider config via the Vercel AI SDK (Gemini free tier hosted / Ollama local), and local in-process embeddings (Transformers.js) so nothing hits a paid API. See FREE_STACK.md.
No feature logic yet. List open questions.
```

**Prompt 0.2 — Scaffold the foundation**
```
Build Phase 0 per PLAN.md: scaffold the app, docker-compose Postgres (postgis + pgvector),
Drizzle + base migration with the sites table (PostGIS geometry), MapLibre map shell using
OpenFreeMap tiles (style https://tiles.openfreemap.org/styles/liberty — no key), Tailwind +
shadcn, the four-module nav with empty placeholder routes, and the /evals runner skeleton.
`npm run dev` boots to the app shell with a working map. Commit.
```

**Prompt 0.3 — Seed + deploy base**
```
Add `npm run seed` with a handful of sample sites. Add deploy config for Vercel (free Hobby) + a
Supabase/Neon free Postgres with postgis + pgvector. Deploy the shell. Confirm the live URL loads
the map.
```

---

## Phase 1 · Capture — schema-driven geo forms  (~3–5 days)

**Prompt 1.1 — Plan**
```
Phase 1: Capture. Plan the NL → JSON Schema → RJSF form builder with map location fields. PLAN.md:
/api/generate (the LLM via the AI SDK — Gemini free/Ollama — one emit_schema tool), Zod guard on output, custom RJSF widgets for
format "geo-point" and "geo-polygon" (MapLibre + Turf, GeoJSON values), how submissions attach to
a site, and the Capture eval cases. No code yet.
```

**Prompt 1.2 — Generation slice**
```
Implement /api/generate: call the configured LLM (AI SDK; Gemini free/Ollama) with one emit_schema tool (JSON-Schema-shaped input). Validate
with Zod; retry once on failure with the error fed back. Prompt box → generated schema in state →
JSON inspector panel.
```

**Prompt 1.3 — Render + geo widgets + save**
```
Render the schema with RJSF + AJV (draft 2020-12). Add custom geo-point (click map → GeoJSON
Point) and geo-polygon (draw via Turf → GeoJSON Polygon) widgets. Make the inspector editable
(live re-render). Save submissions to Postgres linked to a site. Test with a field-survey prompt.
```

**Prompt 1.4 — Evals + deploy**
```
Add Capture eval cases to /evals: schema_valid, field_coverage, conditional_ok, geo_format_ok
(~8 cases). `npm run eval`. Review states + mobile. Deploy. Update README Capture section.
```

---

## Phase 2 · Ask — geospatial RAG  (~1–2 weeks)

**Prompt 2.1 — Plan**
```
Phase 2: Ask. Plan a geospatial RAG assistant over captured data + an open-data corpus, returning
cited answers AND a map of mentioned places. PLAN.md: ingestion (chunk by entry → embed → store),
extend schema with chunks (embedding vector, tsvector, geom, pinned embedding_model), hybrid
retrieve → fuse → rerank, PostGIS spatial filter ("near/within"), answer→map pin resolution,
streaming chat route, grounding guardrail, eval set. Note CC attribution; no bulk copyrighted
content committed. No code yet.
```

**Prompt 2.2 — Schema + ingestion**
```
Add the chunks migration (pgvector + tsvector + PostGIS geom + embedding_model). Build
scripts/ingest: read CC-licensed open geo data + captured sites, chunk by entry, embed **locally**
(Transformers.js — `bge-small-en` / `all-MiniLM`, no API), insert
with tsvector populated and geom where available. Ship a tiny /data/sample. `npm run ingest`.
```

**Prompt 2.3 — Hybrid + spatial retrieval**
```
Implement retrieval: pgvector cosine + HNSW, tsvector/BM25, reciprocal-rank fusion, and an
optional local cross-encoder rerank (`bge-reranker-base` via Transformers.js — ship fusion-only
first if it's heavy, add rerank later), plus an optional PostGIS spatial filter. Return top-k with
source + entry_id + coords. CLI to eyeball results.
```

**Prompt 2.4 — Chat + citations + map**
```
Build the chat route (Vercel AI SDK): retrieve → grounded context → stream answer with inline
citations + grounding guardrail (decline below a rerank threshold). Resolve answer place names
against the PostGIS gazetteer; plot confident matches on the map beside the chat.
```

**Prompt 2.5 — Evals + deploy**
```
Add Ask evals: recall@k, faithfulness (LLM-as-judge), geo_match, refusal_correct (~15 cases).
Check prompt-injection in retrieved text, token-cost logging, CC attribution. Deploy. Update
README Ask section.
```

---

## Phase 3 · Act — agent + MCP tools  (~1.5–2 weeks)

**Prompt 3.1 — Plan**
```
Phase 3: Act. Plan the Locus MCP server (geocode, places_nearby, route, isochrone, elevation,
weather, sun_times) plus an in-app agent that orchestrates them and renders results on the map.
PLAN.md: each tool's I/O + free source (Nominatim/Overpass/OSRM/ORS/Open-Meteo/SunCalc) with cache
+ fixture fallback, the agent loop (plan → call → observe → iterate), human-in-the-loop on
consequential steps, Langfuse tracing, eval scenarios. No code yet.
```

**Prompt 3.2 — MCP server + tools**
```
Build the Locus MCP server (TypeScript MCP SDK) as a package in the repo. Implement the seven
tools with typed I/O, a small cache for rate limits, and fixtures for offline demo. `npm run mcp`.
Test each tool in isolation.
```

**Prompt 3.3 — In-app agent + map**
```
Build the in-app agent (Vercel AI SDK; Gemini free/Ollama) consuming the MCP tools. plan → call → observe
→ iterate; render points/routes/isochrones on the map; human-in-the-loop confirmation on
consequential steps; read-only tools run autonomously.
```

**Prompt 3.4 — Observability + evals + deploy**
```
Wire Langfuse (trace args, latency, cost, errors; UI link). Add Act evals: task_success,
tool_choice, step_efficiency, no_hallucinated_tools (~10 scenarios). Add docs/claude-desktop.md
for using the MCP server externally. Deploy. Update README Act section.
```

---

## Phase 4 · Tracks — trajectory analytics  (~2–3 weeks)

**Prompt 4.1 — Plan**
```
Phase 4: Tracks. Plan GPX/GeoJSON import + PostGIS trajectory analytics + Deck.gl playback +
Highcharts + "explain this trip". PLAN.md: tracks/track_points(geom, ts, elevation, speed)/segments
schema, metrics service (distance, speed, elevation gain, stop/dwell detection via DBSCAN-style
clustering + min-dwell, leg segmentation), synthetic + sample tracks, UI surfaces. No code yet.
```

**Prompt 4.2 — Schema + import + seed**
```
Add migrations for tracks/track_points (PostGIS geography)/segments. Build GPX/GeoJSON import and
`npm run seed` with sample + physically-plausible synthetic tracks (smooth speed, terrain-like
elevation, stops clustered at endpoints). Link tracks to sites/visits.
```

**Prompt 4.3 — Metrics service (test first)**
```
Implement metrics: total/moving distance, avg/max speed, elevation gain/loss, leg segmentation,
stop detection (spatial+temporal clustering + min-dwell — not a speed threshold). Write tests
FIRST against 2–3 hand-calculated examples, then implement until green. `npm test`.
```

**Prompt 4.4 — Playback + charts**
```
Build Deck.gl playback over the map (scrubber, play/pause) + a multi-track density heatmap. Add
Highcharts: speed/elevation profiles, pace-over-distance, dwell timeline. Track summary cards.
```

**Prompt 4.5 — Explain + deploy**
```
Add "Explain this trip": pass COMPUTED metrics into the prompt as grounded facts; the LLM writes
a plain-language briefing (it must not compute/invent numbers). Stream it. Final review of PostGIS
queries + states + mobile. Deploy. Update README Tracks section.
```

---

## After each phase ships

- Record a 30–60s screen capture of that capability → add it to the portfolio card / README.
- Write one short post on the hardest decision (chunking, the route-before-geocode bug, stop
  detection). A live URL + write-up beats a README every time.
- Update the portfolio "About" + tech stack as you ship: RAG, pgvector, PostGIS, evals, MCP,
  Vercel AI SDK, Deck.gl/MapLibre. Reframe the headline toward "geospatial-strong full-stack
  engineer (with deep maritime background)."
