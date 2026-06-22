# Locus — Free Stack

Everything Locus needs, mapped to a free option. The architecture doesn't change — only the
providers do. The Vercel AI SDK is provider-agnostic, so the LLM is a one-line swap (you can drop
in a paid model later if you ever get credits, without rearchitecting).

## Recommended defaults (pick these and move on)

| Need | Free default | Why | Alternatives (also free) |
| --- | --- | --- | --- |
| **LLM** (forms, RAG answers, agent, "explain") | **Google Gemini** free tier (Flash) for the hosted demo · **Ollama** (Llama 3.x / Qwen) for local dev | Gemini's free tier is generous and works through the AI SDK; Ollama is fully local | Groq free tier (fast), OpenRouter free models, Cloudflare Workers AI |
| **Embeddings** | **Local / in-process** via Transformers.js (`bge-small-en` or `all-MiniLM-L6-v2`) | No key, no rate limit, no cost; embed at ingestion time | Gemini embeddings free tier |
| **Reranker** | **Local** small cross-encoder (`bge-reranker-base`) — or skip at first | Keeps retrieval quality without an API | Start with fusion only, add rerank later |
| **Database** (PostGIS + pgvector + tsvector) | **Supabase** free tier | Postgres with PostGIS *and* pgvector enabled out of the box, free | Neon free tier (also supports both) |
| **App hosting** | **Vercel** Hobby (free) | First-class Next.js, free streaming | Cloudflare Pages, Netlify, Render free |
| **Map library** | **MapLibre GL** (open source) | No token, no vendor lock-in | — |
| **Basemap tiles** | **OpenFreeMap** (`https://tiles.openfreemap.org/styles/liberty`) — no key, no signup, unlimited | One URL, zero setup; OSM vector tiles | Protomaps (`.pmtiles`, self-host single file, offline-capable) · MapTiler / Stadia free tier (100K/mo, key) · OSM raster |
| **3D / data layers** | **Deck.gl** (open source) | Free | — |
| **Geocoding** | **Nominatim** (OSM) | Free, no key | — |
| **Places search** | **Overpass** (OSM) | Free, no key | — |
| **Routing + isochrones** | **OpenRouteService** free key | Free tier includes isochrones | self-host Valhalla; OSRM public demo (dev only) |
| **Weather** | **Open-Meteo** | Free, no key | — |
| **Elevation** | **Open-Meteo Elevation** / Open-Topo-Data | Free | — |
| **Sun / golden hour** | **SunCalc** (computed locally) | No API at all | — |
| **Tracing / evals UI** | **Langfuse** free cloud tier — or self-host | Open source, free either way | — |
| **RAG corpus** | Wikivoyage (CC BY-SA), OSM (ODbL), open-gov | Free, openly licensed | — |

## Gotchas worth knowing (these are the real constraints)

- **Embed offline, not in the request path.** Ingestion embeds documents locally once, so the only
  query-time embedding is the user's question — small and cheap. Keeps you off paid embedding APIs
  and within serverless limits.
- **Reranker is the heaviest thing to run serverless.** Options, cheapest first: ship without
  rerank (fusion only) and add it once retrieval needs it; run a small reranker model; or move
  rerank to a tiny separate worker. Don't block Phase 2 on it.
- **Free LLM tiers are rate-limited.** Fine for a demo. Cache identical requests; don't loop the
  agent more than needed; show a friendly message if you hit a limit.
- **Vercel Hobby caps function duration.** Stream responses (you already do). Very long agent runs
  may need chunking; for a demo the streamed loop is fine.
- **The MCP server is a long-running process** — Vercel won't host it well. For the *hosted* demo,
  expose the same geo tools as Next.js API routes; ship the standalone MCP server for local use and
  Claude Desktop. Same tool code, two entry points.
- **Respect OSM usage policies.** Nominatim/Overpass are free but rate-limited and not for heavy
  production load — cache results and keep volume low. Perfect for a portfolio demo.
- **Basemap: OpenFreeMap is a sponsored public instance** — ideal for a demo (no key, no limits),
  but for real production you'd self-host it (it's open source) or switch to a Protomaps
  `.pmtiles` file on cheap object storage (Cloudflare R2 ≈ pennies). Same MapLibre code either
  way — only the style URL changes — so this is a one-line upgrade later, and a good write-up
  topic ("self-hosted maps, zero vendor lock-in").
- **Attribute CC sources.** Wikivoyage is CC BY-SA, OSM is ODbL — keep attribution in the UI and
  don't commit bulk copyrighted corpora; ship ingestion code + a small public sample.

## .env.example (all-free configuration)

```bash
# LLM (pick one provider; AI SDK swaps them)
GEMINI_API_KEY=            # hosted demo (free tier)
# or run Ollama locally and point the AI SDK at http://localhost:11434

# Database (Supabase or Neon free tier; local docker for dev)
DATABASE_URL=

# Geo tools
ORS_API_KEY=              # OpenRouteService free key (routing + isochrones)
# Nominatim / Overpass / Open-Meteo / SunCalc need no keys

# Basemap
# OpenFreeMap: no key, no signup — style URL https://tiles.openfreemap.org/styles/liberty
# (Protomaps self-hosted .pmtiles, or MapTiler/Stadia free tier, are optional upgrades.)

# Tracing
LANGFUSE_PUBLIC_KEY=      # free cloud tier or self-hosted
LANGFUSE_SECRET_KEY=
```

## One-time signups (all free, ~15 min total)

1. **Supabase** (or Neon) → create a project, enable `postgis` + `vector` extensions, copy `DATABASE_URL`.
2. **Google AI Studio** → free Gemini API key. (Optional: install **Ollama** for local dev.)
3. **OpenRouteService** → free account → API key (for routing/isochrones).
4. **Langfuse** → free cloud account → public + secret keys (or self-host later).
5. **Vercel** → connect the repo (Hobby plan).

That's the entire bill: nothing.
