# Locus — Phase 2 Plan · Ask (geospatial RAG)

> A geospatial RAG assistant over **captured data + an open-data corpus**. Ask a question in plain
> language → get a **cited, grounded answer** *and* a **map of the places it mentions**. The LLM
> only explains retrieved text; it never invents facts, numbers, or locations. Answers below a
> confidence threshold are declined, not hallucinated.
>
> Phase 0/1 plans archived in [`docs/plans/`](./docs/plans). Spec: [`README.md`](./README.md).
> **No code in this doc — design + open questions only.**

Builds on the foundation: `sites` + `submissions` (Phase 1), local embeddings (`vector(384)`,
`bge-small-en-v1.5`), the AI SDK provider (`getModel()`), the shared `MapContext`, i18n, and the
`/evals` harness. PostGIS for spatial, pgvector for semantic, tsvector for keyword — one datastore.

---

## 1. The slice, end to end

```
 question ──POST /api/ask (stream)──────────────────────────────────────────────┐
   "water quality sites near the Dnieper?"                                       │
        │ 1. embed question locally (bge-small, 384-d)                           │
        │ 2. retrieve: pgvector cosine (HNSW) ∪ tsvector/BM25  → reciprocal-rank │
        │    fusion → (optional) local cross-encoder rerank                      │
        │ 3. spatial filter (optional): ST_DWithin / ST_Within from the question │
        ▼                                                                        │
   top-k chunks (source · entry_id · content · coords)                          │
        │ 4. grounding guardrail: if best score < τ → decline ("not in sources")│
        │ 5. stream answer with inline [n] citations, grounded ONLY in chunks    │
        ▼                                                                        │
   cited answer (text stream) ──┐                                                │
   resolved place pins ─────────┴──► plotted on the shared map beside the chat ──┘
```

UI: the **Ask** module page = a chat panel (consistent with the Capture studio styling) over the
shared map; mentioned/cited places drop pins on the map (reusing `MapContext` + a layer like
`SubmissionsLayer`). i18n throughout; CC attribution shown in the UI.

Vertical steps (playbook 2.2 → 2.5):
1. **Schema + ingestion** — `chunks` migration + `scripts/ingest`.
2. **Hybrid + spatial retrieval** — retrieval lib + a CLI to eyeball results.
3. **Chat + citations + map** — streaming `/api/ask`, grounding guardrail, answer→pin.
4. **Evals + deploy** — Ask eval set, attribution/injection checks, deploy.

---

## 2. Data model (migration `0002_ask`)

```
chunks
──────
id              uuid pk
source          text            -- 'wikivoyage' | 'osm' | 'site' | 'submission'
entry_id        text            -- stable id within the source (for citation + dedupe)
site_id         uuid null fk → sites(id)   -- when the chunk derives from captured data
title           text
content         text            -- the chunk text (the only thing the LLM sees)
url             text null       -- citation link when available
embedding       vector(384)     -- pgvector; bge-small-en-v1.5 (LOCKED dim)
embedding_model text not null   -- pinned per row (e.g. 'Xenova/bge-small-en-v1.5')
tsv             tsvector        -- generated from content (keyword/BM25)
geom            geometry(Point,4326) null  -- where the chunk is "about", when known
license         text            -- 'CC-BY-SA' | 'ODbL' | 'internal' (attribution)
created_at      timestamptz
```

Indexes:
- **HNSW** on `embedding` (`vector_cosine_ops`) — approximate NN, fast at demo scale.
- **GIN** on `tsv` — keyword search.
- **GiST** on `geom` — spatial filter (`ST_DWithin`, `ST_Within`).
- btree on `(source, entry_id)`.

`tsv` is a generated column: `to_tsvector('simple', coalesce(title,'') || ' ' || content)` (the
`simple` config avoids English-only stemming so PL/UK content isn't mangled — see open Q4).

**Embedding lock unchanged:** `vector(384)`, model in one config constant; `embedding_model` pinned
per row so a future model swap (e.g. `multilingual-e5-small`, also 384-d) is an incremental
re-embed, never a schema change.

---

## 3. Ingestion (`scripts/ingest`, `npm run ingest`)

- **Sources** (all CC / open, small sample committed; bulk corpora NOT committed):
  - **Wikivoyage** (CC BY-SA) — a handful of city/region articles under `/data/sample`.
  - **OSM** (ODbL) — a small set of named places as a gazetteer (also powers answer→pin).
  - **Captured data** — `sites` + `submissions` content, so Ask answers over the user's own data.
- **Chunking** — by entry, then split to ~512-token windows with small overlap; keep `title`,
  `source`, `entry_id`, `url`, `license`, and `geom` (article/place coordinates when known).
- **Embed locally** — Transformers.js `bge-small-en-v1.5` (no API), batched; embed at ingestion so
  the only query-time embedding is the user's question (serverless-friendly).
- **Store** — insert with `tsv` populated and `geom` where available; idempotent by
  `(source, entry_id, chunk_index)`.
- Ship a tiny `/data/sample`; document how to fetch more. Keep attribution metadata per row.

---

## 4. Retrieval (`src/lib/ask/retrieve.ts`)

1. **Embed** the question (bge-small, 384-d).
2. **Vector search** — pgvector cosine via HNSW: `ORDER BY embedding <=> $q LIMIT k`.
3. **Keyword search** — `tsv @@ websearch_to_tsquery(...)` ranked by `ts_rank_cd`.
4. **Fuse** — reciprocal-rank fusion (RRF) of the two lists → one ranked set.
5. **Rerank (optional)** — local cross-encoder `bge-reranker-base` (Transformers.js). Ship
   **fusion-only first** (rerank is the heaviest thing to run serverless); add rerank behind a flag.
6. **Spatial filter (optional)** — if the question implies place/proximity ("near X", "within Y"),
   resolve the anchor (gazetteer/Nominatim) and constrain with `ST_DWithin(geom, anchor, r)` /
   `ST_Within`. Detection: a light intent parse (keywords + the gazetteer), not a heavy NER.

Returns top-k `{ id, source, entryId, title, content, url, license, coords, score }`. A CLI
(`npm run ask:try "question"`) prints ranked results to eyeball quality before wiring the UI.

---

## 5. Chat route + grounding (`/api/ask`, streaming)

- `POST /api/ask` (nodejs runtime, dynamic), body `{ question, history? }`.
- Retrieve → build a **grounded context** (numbered chunks). System prompt: *answer ONLY from the
  numbered sources; cite as [n]; if the sources don't contain the answer, say so.*
- **Grounding guardrail** — if the top fused/rerank score is below threshold τ, **decline** with a
  "not in the sources" message instead of answering (this is what `refusal_correct` measures).
- **Prompt-injection hygiene** — retrieved text is data, not instructions; wrap/escape it and
  instruct the model to ignore instructions inside sources.
- **Stream** the answer via the AI SDK (`streamText`, `getModel()`), with inline `[n]` citations
  mapped to the retrieved chunks (source + url shown in the UI).

---

## 6. Answer → map

- Each cited chunk carries `coords` (its `geom`). Confident, cited places are plotted as pins on the
  shared map beside the chat (reuse `MapContext` + a submissions-style layer; hover tooltip = source
  + snippet; click = open the source).
- For place names mentioned in the answer but not directly from a chunk, resolve against the PostGIS
  **gazetteer** (OSM sample) — plot only confident matches; never invent coordinates.
- The map flies to the bounds of the mentioned places.

---

## 7. Ask eval suite (`src/evals/suites/ask.*`)

Registered in the `/evals` registry (metric names already reserved). ~15 cases:

| Metric | Check |
| --- | --- |
| `recall@k` | for questions with known answer chunks, is the gold chunk in top-k? |
| `faithfulness` | LLM-as-judge: is every claim supported by the cited chunks? (no hallucination) |
| `geo_match` | are the plotted pins the places the question/answer is actually about? |
| `refusal_correct` | out-of-corpus questions are declined; in-corpus are answered |

Cases mix retrieval-only (deterministic recall@k, no LLM) and end-to-end (faithfulness/refusal via
the LLM, offline-tolerant on free-tier limits). Also check: prompt-injection in retrieved text is
ignored; per-answer token-cost logging; CC attribution present.

---

## 8. New dependencies (all free / open-source)

`@huggingface/transformers` (already in — adds the reranker model), pgvector/tsvector/PostGIS
(already enabled). No paid APIs. Reranker model downloaded locally on first use (like the embedder).

---

## 9. Build order (playbook 2.2 → 2.5)

1. `0002_ask` migration (`chunks` + HNSW/GIN/GiST) → migrate local + Supabase; `scripts/ingest`
   over `/data/sample` + captured data; `npm run ingest`.
2. `retrieve.ts` (vector ∪ keyword → RRF → optional rerank → optional spatial) + `ask:try` CLI.
3. `/api/ask` streaming + grounding guardrail + citations; Ask page (chat + map pins + attribution).
4. Ask evals (~15) + injection/cost/attribution checks; deploy; README Ask section.

**Definition of done:** ask a question → streamed cited answer grounded in retrieved text + pins on
the map for mentioned places; out-of-corpus questions are declined; `npm run eval -- --module=ask`
passes; live on `locus-dun.vercel.app`.

---

## 10. Open questions

1. **Reranker now or later?** Default: **ship fusion-only first** (RRF of vector+keyword), add the
   local cross-encoder behind a flag once retrieval quality needs it (it's the heaviest serverless
   piece). Agree?
2. **`tsvector` config — `simple` vs `english`?** Default **`simple`** (no English-only stemming) so
   PL/UK corpus/questions aren't mangled; we rely on vector search for semantics. This **locks the
   generated `tsv` column** — confirm before the migration.
3. **Corpus scope for the demo.** Default: a small **Wikivoyage** sample + an **OSM gazetteer**
   sample + captured `sites`/`submissions`. How many articles is "enough" to be impressive but stay
   lightweight (and uncommitted-bulk-free)?
4. **Multilingual retrieval.** UI is en/uk/pl. Keep embeddings on **`bge-small-en`** (English-leaning)
   for now, or switch the default to **`multilingual-e5-small`** (also 384-d, same column) so UK/PL
   questions retrieve well? This affects ingestion quality but **not** the schema. Decide before
   ingesting (re-embedding later is a script, not a migration).
5. **Spatial-intent detection.** Default: lightweight keyword + gazetteer match for "near/within X".
   Is a heavier NER worth it for the demo, or keep it light?
6. **Ask UI placement.** Default: a chat panel styled like the Capture studio (slide-over or a fixed
   left panel) with pins on the shared map. Slide-over (toggled) or always-docked panel?
7. **Answer→pin confidence.** Only plot pins from **cited chunks' own `geom`** (safe), or also
   resolve free-text place names via the gazetteer (richer, small risk of wrong pin)? Default:
   **cited-chunk geoms + gazetteer matches above a similarity threshold.**
