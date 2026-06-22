# Locus — Phase 0 Foundation Plan

> Shared foundation only. **No feature logic.** Every later phase (Capture / Ask / Act / Tracks)
> is a vertical slice on top of what's defined here. The goal of Phase 0: `npm run dev` boots to an
> app shell with a working map, a migrated Postgres (PostGIS + pgvector) with a `sites` table, the
> four-module nav, and an `/evals` runner that prints results.

Source of truth: [`README.md`](./README.md) (spec) and [`FREE_STACK.md`](./FREE_STACK.md) (providers).
Everything below stays inside the 100%-free stack and keeps the LLM provider a one-line swap.

---

## 1. Decisions locked for Phase 0

| Area | Choice | Note |
| --- | --- | --- |
| App | **Single Next.js app** (App Router) + TypeScript, **not** a multi-package monorepo (yet) | One deployable. The MCP server (Phase 3) is the only thing that may later become a workspace package; structure leaves room for it. |
| Package manager | **npm** | Matches `BUILD_PLAYBOOK.md` (`npm run …`). |
| DB (local) | **docker-compose** `postgis/postgis:16-3.4` + **pgvector layered via 2-line Dockerfile** — **LOCKED** | PostGIS image ships *without* pgvector; add it on top (`postgresql-16-pgvector`), don't swap the base. Mirrors Supabase (both extensions present). Verify on first `db:up`. |
| DB (hosted) | **Supabase** free tier — **LOCKED** (pooler on :6543 already provisioned) | Used for prod *and* as `DATABASE_URL`. Neon not pursued — switching now discards working setup for no gain. |
| ORM / migrations | **Drizzle** (`drizzle-orm` + `drizzle-kit`) | SQL-first migrations; raw SQL for PostGIS/vector columns Drizzle doesn't model natively. |
| Map | **MapLibre GL** + **OpenFreeMap** `liberty` style | No key, no signup. |
| UI | **Tailwind** + **shadcn/ui** | Left module nav: Capture / Ask / Act / Tracks. |
| LLM | **Vercel AI SDK**, provider = Gemini free (hosted) / **Ollama** (local) | Single `getModel()` factory; swap by env. |
| Embeddings | **Transformers.js**, in-process. `vector(384)` **LOCKED**; model `bge-small-en-v1.5` (default) via one config constant | No API, no key. 384-d holds the index light (matters on free Supabase/Vercel). Falling back to `multilingual-e5-small` (also 384-d) for PL/UK content is a **config + re-embed**, not a schema change — see §9. |
| Evals | **In-repo runner** (`/evals`), JSONL results writer | Modules register cases; Phase 0 ships a passing smoke case. |
| Tracing | **Langfuse** free tier, lazily initialized | Keys optional in Phase 0; no-op if unset. |

### Why single app, not monorepo
The four modules share Next.js, Postgres, the AI SDK, MapLibre, and the eval harness almost
entirely (README "Why one app, four modules"). A Turborepo/pnpm-workspace split adds tooling cost
with no Phase-0 benefit. **One concession:** the Phase-3 MCP server is a long-running process Vercel
won't host (FREE_STACK gotcha), so its tool code lives under `packages/` from the start and is
imported by both a future standalone server and the in-app API routes. Phase 0 only creates the
empty placeholder; no workspace wiring until Phase 3 needs it.

---

## 2. Repository / app structure

```
locus/
├─ README.md  FREE_STACK.md  BUILD_PLAYBOOK.md  PLAN.md
├─ .env.example                      # all-free config (see §8)
├─ .env.local                        # gitignored, real values
├─ docker-compose.yml                # Postgres + PostGIS + pgvector (§4)
├─ package.json                      # scripts: dev/build/db:*/seed/eval/lint
├─ tsconfig.json                     # paths: "@/*" -> "src/*"
├─ next.config.ts
├─ tailwind.config.ts  postcss.config.mjs
├─ components.json                   # shadcn/ui config
├─ drizzle.config.ts                 # Drizzle Kit (§5)
├─ docker/
│  └─ initdb/
│     └─ 001-extensions.sql          # CREATE EXTENSION postgis, vector
├─ drizzle/                          # generated SQL migrations + journal
│  ├─ 0000_init.sql
│  └─ meta/
├─ public/                           # static assets, map icons
├─ src/
│  ├─ app/                           # App Router
│  │  ├─ layout.tsx                  # root: fonts, <body>, providers
│  │  ├─ globals.css                 # Tailwind + shadcn CSS vars
│  │  ├─ page.tsx                    # "/" -> redirect to /capture (or landing)
│  │  ├─ (modules)/                  # route group sharing AppShell layout
│  │  │  ├─ layout.tsx               # AppShell: left nav + map region (§7)
│  │  │  ├─ capture/page.tsx         # placeholder
│  │  │  ├─ ask/page.tsx             # placeholder
│  │  │  ├─ act/page.tsx             # placeholder
│  │  │  └─ tracks/page.tsx          # placeholder
│  │  └─ api/
│  │     └─ health/route.ts          # GET -> { db: ok, postgis, vector }
│  ├─ components/
│  │  ├─ ui/                         # shadcn primitives (button, card, …)
│  │  ├─ layout/
│  │  │  ├─ app-shell.tsx
│  │  │  └─ module-nav.tsx           # Capture/Ask/Act/Tracks links + icons
│  │  └─ map/
│  │     ├─ map-shell.tsx            # MapLibre wrapper ('use client') (§6)
│  │     └─ map-config.ts            # style URL, default center/zoom
│  ├─ db/
│  │  ├─ client.ts                   # drizzle(postgres(DATABASE_URL))
│  │  ├─ schema.ts                   # tables (sites in Phase 0) (§5)
│  │  └─ types.ts                    # inferred + GeoJSON helper types
│  ├─ lib/
│  │  ├─ ai/
│  │  │  ├─ provider.ts              # getModel() — Gemini | Ollama (§9)
│  │  │  └─ embeddings.ts            # Transformers.js singleton embed() (§9)
│  │  ├─ env.ts                      # zod-validated env (server-only)
│  │  └─ utils.ts                    # cn(), misc
│  └─ evals/                         # shared eval harness (§10)
│     ├─ runner.ts                   # discover + run registered suites
│     ├─ writer.ts                   # JSONL + console summary
│     ├─ types.ts                    # EvalCase, EvalResult, Suite
│     ├─ index.ts                    # registry; modules push suites here
│     ├─ suites/
│     │  └─ foundation.smoke.ts      # Phase-0 passing smoke suite
│     └─ results/                    # gitignored output (.jsonl)
├─ scripts/
│  ├─ seed.ts                        # sample sites (Phase 0.3)
│  └─ check-db.ts                    # verify extensions present
└─ packages/
   └─ locus-mcp/                     # EMPTY placeholder (Phase 3); README stub only
```

**Path alias:** `@/*` → `src/*`. Server-only modules (`db/`, `lib/ai/`, `lib/env.ts`) guarded so
they never bundle into client components.

---

## 3. package.json scripts

```jsonc
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "db:up": "docker compose up -d",
    "db:down": "docker compose down",
    "db:generate": "drizzle-kit generate",   // SQL from schema.ts
    "db:migrate": "tsx scripts/migrate.ts",  // apply migrations (drizzle-orm/.../migrate)
    "db:check": "tsx scripts/check-db.ts",   // assert postgis+vector enabled
    "seed": "tsx scripts/seed.ts",
    "eval": "tsx src/evals/runner.ts"
  }
}
```
Runner uses **`tsx`** for TS scripts (no build step). `db:migrate` runs Drizzle's migrator against
`DATABASE_URL`; custom-SQL migrations (PostGIS/vector) live in the same `drizzle/` folder so one
command applies everything.

---

## 4. docker-compose — Postgres + PostGIS + pgvector

One container. **LOCKED approach:** base `postgis/postgis:16-3.4` ships PostGIS but **not** pgvector,
so we layer pgvector on with a 2-line Dockerfile (keep PostGIS as base — adding PostGIS onto a
pgvector image is harder than the reverse). This mirrors Supabase, where both extensions are already
present. Init scripts in `/docker-entrypoint-initdb.d` then `CREATE EXTENSION` once on first boot.

```dockerfile
# docker/Dockerfile
FROM postgis/postgis:16-3.4
RUN apt-get update && apt-get install -y postgresql-16-pgvector && rm -rf /var/lib/apt/lists/*
```

```yaml
# docker-compose.yml
services:
  db:
    build: { context: ., dockerfile: docker/Dockerfile }
    container_name: locus-db
    environment:
      POSTGRES_USER: locus
      POSTGRES_PASSWORD: locus
      POSTGRES_DB: locus
    ports: ["5432:5432"]
    volumes:
      - locus-pgdata:/var/lib/postgresql/data
      - ./docker/initdb:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U locus -d locus"]
      interval: 5s
      timeout: 3s
      retries: 10
volumes:
  locus-pgdata:
```

```sql
-- docker/initdb/001-extensions.sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;     -- pgvector
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- helps keyword/fuzzy later
```

Local `DATABASE_URL`: `postgres://locus:locus@localhost:5432/locus`.
On Supabase/Neon the same `CREATE EXTENSION` runs as the first migration (both support all three).

---

## 5. Drizzle setup + base migration (`sites`)

**Driver:** `postgres` (postgres.js) + `drizzle-orm/postgres-js`. **Kit:** `drizzle-kit` for
`generate`. Custom-type columns (PostGIS `geometry`, pgvector `vector`) use Drizzle `customType` so
the TS schema stays the single source while emitting correct SQL.

```ts
// src/db/schema.ts  (Phase 0 = sites only; later phases append tables)
import { pgTable, uuid, text, jsonb, timestamp, doublePrecision, index } from "drizzle-orm/pg-core";
import { geometry } from "./types"; // customType -> geometry(Point,4326)

export const sites = pgTable("sites", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),                 // domain-agnostic label
  geom: geometry("geom").notNull(),           // POINT, SRID 4326
  properties: jsonb("properties").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  geomIdx: index("sites_geom_gist").using("gist", t.geom),  // spatial index
}));
```

`geometry`/`vector` custom types live in `src/db/types.ts` (return as GeoJSON via `ST_AsGeoJSON`
in queries; store via `ST_GeomFromGeoJSON` / `ST_SetSRID(ST_MakePoint(lng,lat),4326)`).

**Migration `0000_init.sql`** (generated then hand-augmented):
1. `CREATE EXTENSION` for postgis, vector, pg_trgm (idempotent — covers hosted DBs whose init
   script we don't control).
2. `CREATE TABLE sites …` with `geom geometry(Point, 4326) NOT NULL`.
3. `CREATE INDEX sites_geom_gist ON sites USING GIST (geom);`
4. `updated_at` trigger (or handle in app) — trigger preferred so raw SQL stays correct.

**`sites` is the anchor table.** Phase 1 submissions, Phase 2 chunks, Phase 4 tracks all FK to (or
spatially relate to) `sites`. Defining it now is the whole point of Phase 0's DB work.

A `GET /api/health` route runs `SELECT postgis_version()`, checks `vector` in `pg_extension`, and
`SELECT 1` — the deploy smoke test for Phase 0.3.

---

## 6. Map shell (MapLibre GL + OpenFreeMap)

```ts
// src/components/map/map-config.ts
export const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty"; // no key, no signup
export const DEFAULT_CENTER: [number, number] = [0, 20];
export const DEFAULT_ZOOM = 1.6;
```

```tsx
// src/components/map/map-shell.tsx  ('use client')
// - dynamic import of 'maplibre-gl' (window-only); import its CSS
// - new maplibregl.Map({ container, style: MAP_STYLE, center, zoom })
// - NavigationControl + AttributionControl (OSM/OpenFreeMap credit, required)
// - exposes a ref/context so later modules add sources/layers (pins, routes, deck.gl overlay)
// - cleanup map.remove() on unmount; resize observer for responsive panel
```

Rendered client-side only (`next/dynamic`, `ssr: false`) inside `AppShell`. **Upgrade path baked
in:** swapping `MAP_STYLE` to a Protomaps `.pmtiles` style or OSM raster is the *only* change needed
for self-hosted/offline (FREE_STACK) — kept as a single constant so it's a one-line switch later.
Deck.gl is **not** added in Phase 0 (Phase 4), but the map ref is exposed so an overlay can attach.

---

## 7. Design system + app layout

- **Tailwind** + **shadcn/ui** (`components.json`, CSS variables theme, `cn()` helper).
- Install a minimal primitive set now: `button`, `card`, `tooltip`, `separator`, `scroll-area`,
  `sheet` (mobile nav). More added per phase.
- **AppShell** (`(modules)/layout.tsx`): fixed **left module nav** + main content region that hosts
  the map and module panels.

```
┌────────────────────────────────────────────────────────┐
│  Locus                                          [theme] │  top bar (slim)
├────────┬───────────────────────────────────────────────┤
│ ▣ Capture │                                             │
│ ◎ Ask     │            module content / panels          │
│ ⚙ Act     │            (map region lives here)          │
│ ⟿ Tracks  │                                             │
│           │                                             │
│ ─────     │                                             │
│ ◔ status  │                                             │
└────────┴───────────────────────────────────────────────┘
```

`module-nav.tsx`: four links (`/capture /ask /act /tracks`) with lucide icons + active-state
highlight via `usePathname()`. Collapses into a shadcn `Sheet` on mobile. Phase-0 module pages are
**placeholders** ("Capture — coming in Phase 1") so the shell is navigable and demoable.

---

## 8. `.env.example` (all-free)

```bash
# ── LLM (pick ONE provider; AI SDK swaps them — see src/lib/ai/provider.ts) ──
LLM_PROVIDER=gemini                 # gemini | ollama
GEMINI_API_KEY=                     # Google AI Studio, free tier (hosted demo)
GEMINI_MODEL=gemini-1.5-flash       # free-tier chat model
# Local alternative (no key): run Ollama, then:
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1

# ── Embeddings (local, in-process — no key, no cost) ──
EMBEDDINGS_MODEL=Xenova/bge-small-en-v1.5   # Transformers.js; alt all-MiniLM-L6-v2

# ── Database (Supabase or Neon free tier; local docker for dev) ──
DATABASE_URL=postgres://locus:locus@localhost:5432/locus

# ── Geo tools (Phase 3; Nominatim/Overpass/Open-Meteo/SunCalc need no key) ──
ORS_API_KEY=                        # OpenRouteService free key (routing + isochrones)

# ── Basemap (no env needed) ──
# OpenFreeMap style: https://tiles.openfreemap.org/styles/liberty  (no key, no signup)

# ── Tracing (Langfuse free tier; optional — no-op if unset) ──
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_BASEURL=https://cloud.langfuse.com
```

`src/lib/env.ts` validates these with zod at server startup; LLM keys required only when the chosen
`LLM_PROVIDER` needs them, Langfuse keys always optional.

---

## 9. LLM provider + local embeddings (Vercel AI SDK)

```ts
// src/lib/ai/provider.ts — one factory; phases never touch provider details
import { createGoogleGenerativeAI } from "@ai-sdk/google";
// Ollama via an OpenAI-compatible / community provider pointed at OLLAMA_BASE_URL
export function getModel() {
  if (env.LLM_PROVIDER === "ollama") return ollama(env.OLLAMA_MODEL);
  return google(env.GEMINI_MODEL);            // default: Gemini free tier
}
```
All feature code calls `getModel()` (+ AI SDK `generateText`/`streamText`/tool-calling). Swapping to
a paid model later (e.g. Claude via `@ai-sdk/anthropic`) is a one-line change here — README promise.

**Single source of truth for the embedding lock** — model + dimension live in ONE constant so a
model swap never touches code or schema:
```ts
// src/lib/ai/embeddings.config.ts
export const EMBEDDING = {
  model: env.EMBEDDINGS_MODEL ?? "Xenova/bge-small-en-v1.5",
  dim: 384,                       // LOCKED -> vector(384) column in Phase 2
} as const;
// Multilingual fallback (PL/UK): "Xenova/multilingual-e5-small" — ALSO 384-d, drops into the same
// vector(384) column. Swapping = change this constant + run the re-embed script. No migration.
```
```ts
// src/lib/ai/embeddings.ts — local, in-process, no API
import { pipeline } from "@xenova/transformers";
import { EMBEDDING } from "./embeddings.config";
let extractor; // module-level singleton (load once)
export async function embed(texts: string[]): Promise<number[][]> {
  extractor ??= await pipeline("feature-extraction", EMBEDDING.model);
  // mean-pool + normalize -> vectors of length EMBEDDING.dim
}
```
Phase 2's `chunks` table keeps a per-row **`embedding_model`** column (already in its plan), so even
mixed-model corpora are unambiguous and re-embeds are incremental. That column + this constant are
the entire hedge — the 384-d lock is never the thing that forces a rewrite.
Phase 0 only ships these factories + a trivial test (smoke eval calls `embed(["hello"])` and asserts
vector length). **No retrieval/RAG yet** — that's Phase 2, which will store the model name alongside
vectors so embeddings are never silently mixed.

---

## 10. Shared `/evals` skeleton

A tiny, dependency-light harness the four modules plug into — evals are a first-class concern
(README). Phase 0 ships the runner + writer + one passing suite.

```ts
// src/evals/types.ts
export type EvalCase<I, O> = { name: string; input: I; run: (i: I) => Promise<O>;
  checks: ((o: O) => { metric: string; pass: boolean; score?: number; note?: string })[] };
export type Suite = { module: "foundation"|"capture"|"ask"|"act"|"tracks";
  name: string; cases: EvalCase<any, any>[] };
export type EvalResult = { module: string; suite: string; case: string;
  metric: string; pass: boolean; score?: number; note?: string; ts: string };
```

- **`index.ts`** — central registry; each module appends its suite(s). Phase 0 registers
  `foundation.smoke` only.
- **`runner.ts`** (`npm run eval`) — runs all registered suites (or filter by `--module`), collects
  `EvalResult[]`, prints a per-metric pass/fail summary table, exits non-zero if any case fails.
- **`writer.ts`** — appends results to `src/evals/results/<timestamp>.jsonl` (gitignored) so runs
  are diffable over time; later wired to Langfuse (Phase 3).
- **`foundation.smoke.ts`** — proves the harness end to end without feature logic:
  - DB reachable + `postgis`/`vector` extensions present (queries `pg_extension`).
  - `embed(["hello"])` returns a vector of expected dimension.
  - `getModel()` constructs without throwing (no network call — config only).

Module metric names are reserved now so suites slot in later: Capture `schema_valid ·
field_coverage · conditional_ok · geo_format_ok`; Ask `recall@k · faithfulness · geo_match ·
refusal_correct`; Act `task_success · tool_choice · step_efficiency · no_hallucinated_tools`;
Tracks `metric-vs-hand-calculated`.

---

## 11. Phase 0 build order (maps to BUILD_PLAYBOOK 0.2 / 0.3)

1. `create-next-app` (App Router, TS, Tailwind, ESLint, `src/`, `@/*` alias).
2. shadcn init + base primitives; `globals.css` theme.
3. docker-compose + initdb SQL; `npm run db:up`; `db:check` passes.
4. Drizzle config + `schema.ts` (`sites`) + generate + `db:migrate`; `/api/health` green.
5. MapLibre `map-shell.tsx` + OpenFreeMap style; renders in AppShell.
6. AppShell + module-nav + four placeholder routes; `npm run dev` boots to a working map.
7. `lib/ai/provider.ts` + `lib/ai/embeddings.ts` + `lib/env.ts`.
8. `/evals` runner + writer + `foundation.smoke`; `npm run eval` passes.
9. **Commit.** (0.3) `scripts/seed.ts` sample sites; Vercel + Supabase/Neon deploy; live URL loads
   the map and `/api/health` is green.

**Definition of done:** `npm run db:up && npm run db:migrate && npm run dev` → app shell with a live
OpenFreeMap map, navigable four-module nav, green `/api/health`; `npm run eval` prints a passing
foundation suite; deployed shell URL loads.

---

## 12. Open questions

### Resolved (locked before scaffold)
- **R1 — DB hosting:** **Supabase** (pooler :6543 provisioned). Prod + `DATABASE_URL`. Neon dropped.
- **R2 — Embeddings:** **`vector(384)`**, model `bge-small-en-v1.5` via one constant (§9); per-row
  `embedding_model` in Phase 2. Multilingual fallback `multilingual-e5-small` is also 384-d → swap
  = config + re-embed, never a migration.
- **R3 — Local pgvector:** layer onto `postgis/postgis:16-3.4` with a 2-line Dockerfile (§4).
  Verify on first `db:up`.

### Schema- / data-shape-locking — RESOLVED before scaffold
- **R4 — Geometry convention for `sites` (LOCKED):**
  - **SRID 4326** everywhere (WGS84). ✅
  - **GeoJSON at the API boundary** — read via `ST_AsGeoJSON`, write via `ST_GeomFromGeoJSON`;
    store native `geometry` internally. ✅
  - **`sites.geom = geometry(Point, 4326) NOT NULL`** — Point-anchor. Strict validation + fast
    pin/`ST_DWithin`. If a site ever needs an extent, add a **nullable `area geometry(Polygon,4326)`**
    column later — additive migration, not a rewrite. Capture's polygon widget values live in
    submissions, not in `sites.geom`.
  - **`geometry` for `sites`** (planar ops fine for pins) vs **`geography` for Tracks** (Phase 4,
    accurate metric distance). Intentional split — no Phase-0 action.

### Non-schema — proceeding on defaults (design / nav / tooling only)
- **Q1 — Landing route:** `/` redirects to `/capture`. (UI)
- **Q2 — Ollama:** optional; Gemini default everywhere, even locally. (config)
- **Q3 — Map theme:** world view + light style for Phase 0; dark map variant wired later. (design)
- **Q4 — Monorepo trigger:** stay single-app; `packages/locus-mcp/` placeholder only until Phase 3
  forces a workspace split. (structure)
- **Q5 — CI:** defer a GitHub Action (typecheck + `npm run eval`) until after 0.3. (tooling)

None of Q1–Q5 touch the database schema or the on-the-wire data shape, so they don't block scaffold.
```
