# Locus — portfolio case study

**One Next.js + Postgres app where AI orchestration is the product, not a bolt-on.**
Live: https://locus-dun.vercel.app · Code: this repo · Stack: TypeScript end-to-end.

> Built solo as a senior full-stack reference project: a geospatial workspace that **captures**
> location data from natural language, **answers** questions about it with cited RAG, and **acts**
> on it through a tool-using agent — all over a single PostGIS + pgvector database, on a 100%-free
> stack, deployed and demoable at every phase.

---

## Why it's interesting (the senior signals)

- **Three distinct AI patterns in one codebase**, not one trick repeated: *structured generation*
  (NL → JSON Schema → live forms), *retrieval-augmented generation* (geospatial RAG with a
  grounding gate), and *agentic tool orchestration* (multi-step plan→act→observe loop). Each is the
  right tool for its job, and they share one provider abstraction, one database, one map.
- **The agent is exposed two ways from one implementation** — in-app over HTTP streaming, and to any
  MCP client (Claude Desktop) over stdio — by factoring the tools into a dependency-free core. This
  is the kind of boundary design that separates "called an LLM API" from "built an AI system."
- **Production concerns are first-class:** observability (OpenTelemetry → Langfuse), an evaluation
  harness with per-capability metrics, a provider-agnostic model layer (Gemini ⇄ Ollama ⇄ Claude as
  a one-line swap), and serverless-aware architecture decisions documented with their trade-offs.
- **Full-stack depth, not breadth theatre:** a single Postgres carrying three index types
  (PostGIS GiST, pgvector HNSW, tsvector GIN), typed migrations, streaming APIs, a non-trivial
  MapLibre integration, i18n, dark mode, responsive UI, and browser-driven verification.

---

## AI orchestration in detail

### 1. Agentic tool use (the "Act" module)
A streaming agent built on the Vercel AI SDK that completes free-form location tasks by composing
seven geo tools (geocode, places-nearby, route, isochrone, elevation, weather, sun-times):

- **Multi-step reasoning loop** — `streamText` with `stepCountIs(8)`: the model plans, calls a tool,
  observes the structured result, and iterates until the task is done. A task like *"how long to
  drive from Kyiv to Lviv"* fans out to geocode → geocode → route without being told the steps.
- **Guardrails against hallucinated facts** — a system contract forces *geocode-before-route* and
  forbids inventing coordinates, distances, or durations; numbers must come from a tool result.
- **Tool schemas as the contract** — each tool is a Zod schema; the SDK validates the model's
  arguments, so a malformed or invented tool call can't execute. (Learned the hard way that Gemini
  function-calling rejects tuple schemas — switched to `array(number)`.)
- **Streamed to the UI as a live trace** — text deltas, tool-call chips, and resulting GeoJSON
  features stream over NDJSON and render on the shared map in real time.

### 2. Model Context Protocol server
The exact same tool functions are re-published as an **MCP stdio server**
(`@modelcontextprotocol/sdk`), so the agent's capabilities work inside Claude Desktop or any MCP
client. Achieved by splitting the tools into a pure core (`tools-core.ts`: Zod + fetch, no app/AI-SDK
imports) wrapped by two thin adapters — one for the AI SDK, one for MCP. **One implementation, two
surfaces.**

### 3. Retrieval-augmented generation (the "Ask" module)
A geospatial RAG assistant that answers in plain language *and* maps the places it mentions:

- **Hybrid retrieval** — dense vector search (pgvector HNSW, cosine) **unioned** with full-text
  keyword search (`tsvector`/`websearch_to_tsquery`), fused with **Reciprocal Rank Fusion**, with an
  optional `ST_DWithin` spatial filter.
- **Grounding gate** — answers only when top similarity clears τ=0.6; otherwise it declines instead
  of hallucinating. Verified by refusal evals (in-corpus answers, out-of-corpus declines).
- **Faithful citations** — the UI shows only the sources actually cited `[n]` in the answer, decoded
  UTF-8-correct (a mojibake bug I tracked to `atob` not handling multibyte).

### 4. Structured generation (the "Capture" module)
Natural-language descriptions become real data-entry forms: the LLM emits a **JSON Schema** (via
tool-calling for reliable structure), rendered with RJSF + AJV (draft 2020-12), where location
fields are custom React widgets — a click-to-drop **geo-point** map and a **geo-polygon** drawing
tool (terra-draw + Turf area) — that round-trip as GeoJSON into PostGIS.

### 5. Observability & evaluation
- **Tracing** — `experimental_telemetry` emits OpenTelemetry spans exported to **Langfuse** via an
  opt-in `instrumentation.ts` (no-ops without keys, nodejs-runtime-guarded for Vercel).
- **Evals** — a lightweight harness (suites → cases → metric checks → JSONL results) with
  per-capability metrics: Capture `schema_valid / geo_format_ok`, Ask `recall@k / refusal_correct`,
  Act `task_success / tool_choice / no_hallucinated_tools / step_efficiency`. Rate-limited free-tier
  errors degrade to "skipped" so CI stays green.
- **Provider-agnostic** — one `getModel()` switches Gemini (hosted free) and Ollama (local, no key);
  swapping in a paid model (Claude) is a single line, no rearchitecting.

---

## Full-stack & platform engineering

- **One database, three search modalities** — PostGIS `geometry(4326)` + GiST for spatial,
  pgvector `vector(768)` + HNSW for semantic, `tsvector` + GIN for keyword, on one Supabase
  Postgres. Drizzle ORM with typed, generated migrations.
- **Serverless-aware decisions, documented** — local ONNX embeddings failed to load in a Vercel
  function, so embeddings moved to the AI SDK (Gemini, 768-d) with the trade-off written down; the
  Postgres client is lazy-initialised to survive Next.js build-time page-data collection.
- **Maps as real engineering** — MapLibre GL on free OpenFreeMap tiles: per-module control
  placement, hover tooltips via `queryRenderedFeatures`, language-aware place labels, and a
  **theme-aware basemap** that recreates the map on dark/light toggle so every feature layer
  re-attaches cleanly while preserving the viewport.
- **Product polish** — i18n (en/uk/pl with browser auto-detect), default-dark "GIS dashboard"
  theme with a light toggle, mobile-responsive slide-overs and collapsing nav.
- **Verification, not vibes** — drove the running app under Playwright (swiftshader WebGL) to
  capture screenshots and catch real bugs (an RJSF field-scoping defect, a polygon-area crash on an
  empty object) that unit tests wouldn't surface.
- **Shipped, free, phased** — deployed on Vercel Hobby + Supabase free with the deploy gotchas
  (framework detection, URL-encoded DB passwords, deployment protection) solved and recorded; every
  phase is independently live.

---

## Honest status

| Module | State |
| --- | --- |
| Capture | ✅ built & deployed |
| Ask | ✅ built & deployed |
| Act (agent + 7 tools + MCP) | ✅ built & deployed; Langfuse + Act evals wired, pending a quota window for live numbers |
| Tracks (PostGIS analytics, stop detection, playback, AI briefing) | ✅ built & deployed; metric evals pass against hand-calculated examples |

The only thing gating "100% complete" on Act's live metrics is the Gemini **free-tier daily cap
(~20 requests/day)** — a deliberate cost constraint of the free stack, not an architectural limit;
the provider swap removes it.

---

## Stack

**Frontend** Next.js (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 · shadcn/ui ·
MapLibre GL · RJSF · terra-draw · Turf.js
**AI** Vercel AI SDK v6 · Gemini (free) / Ollama / Claude-ready · pgvector RAG (RRF, HNSW) ·
Model Context Protocol · Langfuse (OpenTelemetry)
**Data** Postgres + PostGIS + pgvector + tsvector (Supabase) · Drizzle ORM
**Platform** Vercel · Docker (local DB) · Playwright (verification) · custom eval harness
