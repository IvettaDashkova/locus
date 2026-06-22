# Locus — Phase 1 Plan · Capture (schema-driven geo forms)

> Build a form builder: a plain-English description → a generated JSON Schema → an RJSF form whose
> **location fields are real map widgets** → submissions saved to Postgres and anchored to a `site`.
> The LLM only *structures* (emits a schema); it never invents data. Generated schemas are
> Zod-validated before use.
>
> Phase 0 plan archived at [`docs/plans/phase-0-foundation.md`](./docs/plans/phase-0-foundation.md).
> **No code in this doc — design + open questions only.** Spec: [`README.md`](./README.md).

Builds directly on the Phase-0 foundation: `getModel()` (AI SDK v6), the `sites` table +
`getDb()/getClient()`, the MapLibre shell (`MapShell` exposes the map via `onReady`), shadcn/ui, and
the `/evals` registry (`src/evals/index.ts`).

---

## 1. The slice, end to end

```
 prompt box ──POST /api/generate──► getModel() (Gemini/Ollama)
   "a field survey form with        + one tool: emit_schema(JSON-Schema-shaped input)
    site name, condition rating,            │
    photo notes, and a location"            ▼
                                     Zod guard validates the emitted schema
                                     (retry once, feeding the error back)
                                            │  valid JSON Schema + uiSchema
                                            ▼
   JSON inspector (editable) ◄────► RJSF + AJV (draft 2020-12) renders the form
                                            │   custom widgets by format:
                                            ▼   • geo-point  → click map → GeoJSON Point
                                     filled formData            • geo-polygon → draw → GeoJSON Polygon
                                            │
                                     POST /api/submissions
                                            ▼
                                     upsert site (from the designated geo-point) + insert submission
                                     → pin appears on the shared map
```

Three vertical steps (each commit-sized, matching playbook 1.2 / 1.3 / 1.4):
1. **Generate** — `/api/generate` + Zod guard + prompt box + read-only JSON inspector.
2. **Render + geo widgets + save** — RJSF/AJV, the two map widgets, editable inspector, persistence.
3. **Evals + polish** — Capture eval suite, states/mobile, deploy, README update.

---

## 2. Data model (new migration `0001_capture`)

Two tables, both anchoring to `sites` (the Phase-0 anchor):

```
forms                                   submissions
─────                                   ───────────
id          uuid pk                     id          uuid pk
name        text                        form_id     uuid fk → forms(id)
description text                        site_id     uuid fk → sites(id)   -- the site this is about
json_schema jsonb     -- generated      data        jsonb                 -- full RJSF formData (source of truth)
ui_schema   jsonb     -- widget hints    geom        geometry(Point,4326)  -- projected primary geo-point (spatial index)
created_at  timestamptz                 created_at  timestamptz
```

- **`forms`** persists a generated schema so one form yields many submissions (and so evals/demo can
  reload it). Generation can also run ephemerally (generate → fill → submit) — persisting is the
  default; see open Q2.
- **`submissions.data`** is the canonical record (exact GeoJSON the user entered). We additionally
  **project** the form's designated location field into `submissions.geom` (PostGIS) so submissions
  are spatially queryable without digging through JSON — same pattern Phase 2/4 will reuse.
- **Geometry convention is unchanged from Phase 0:** SRID 4326, GeoJSON at the API boundary
  (`ST_GeomFromGeoJSON` on write, `ST_AsGeoJSON` on read), `geometry(Point,4326)` + GiST index.
- A `geo-polygon` value, when present, is stored in `data` as GeoJSON for now; a dedicated
  `geometry(Polygon,4326)` column is an additive migration if/when a module needs to query it.

### How a submission attaches to a site
The form designates **one** `geo-point` field as the site location (via a `ui:options` flag, default
= the first geo-point). On submit:
- if the form also has a "name"-like field, **upsert a site** (`name` + `geom` from the geo-point) and
  link `submissions.site_id`;
- if a site is instead chosen from existing ones (picker), link to it and skip creation.
Default for the demo: **create-or-select** (new site from the geo-point, with an optional "attach to
existing site" toggle). See open Q1.

---

## 3. `/api/generate` — NL → JSON Schema

- **Route:** `POST /api/generate` (nodejs runtime, dynamic), body `{ prompt: string }`.
- **Model:** `getModel()` (Gemini free / Ollama) via AI SDK v6 `generateText`.
- **One tool — `emit_schema`** (AI SDK v6: `tool({ description, inputSchema })`, `toolChoice:
  'required'`). Its `inputSchema` is a **Zod meta-schema** describing the subset of JSON Schema we
  support, so the model is forced to return a structurally-valid schema, not prose.
  - *Alternative considered:* `generateObject`. We keep the explicit **tool** (per playbook) — it
    makes the "LLM structures, never invents" boundary legible and logs cleanly in Langfuse (Phase 3).
- **Supported JSON-Schema subset** (the Zod guard enforces exactly this):
  - root `type: "object"`, `properties`, `required`, `title`, `description`;
  - field types: `string` | `number` | `integer` | `boolean` | `array` (of the above);
  - `enum`, `format` (incl. our custom **`geo-point`** / **`geo-polygon`**, plus `email`/`date`/`uri`);
  - constraints: `minimum`/`maximum`/`minLength`/`maxLength`/`pattern`;
  - **conditionals:** `allOf` with `if`/`then` (RJSF + AJV draft 2020-12 support these) — this is what
    the `conditional_ok` eval checks.
- **Zod guard + retry:** validate the emitted object against the meta-schema. On failure, **retry
  once** with the validation error appended to the prompt ("your schema failed validation: …; fix
  it"). Second failure → 422 with the error (surfaced in the UI, not a crash).
- **Returns:** `{ jsonSchema, uiSchema }`. `uiSchema` is derived (map `format: geo-point` →
  `ui:widget: geoPoint`, mark the designated site-location field, set `ui:order`).

---

## 4. Render + geo widgets (client)

- **RJSF + AJV draft 2020-12** (`@rjsf/core` + `@rjsf/validator-ajv8`, `@rjsf/utils`). Register the
  custom formats `geo-point` / `geo-polygon` with AJV (format validators that accept GeoJSON
  Point/Polygon) so validation passes, and register the matching **custom widgets**.
- **`GeoPointInput`** (`ui:widget: geoPoint`): an embedded MapLibre map (reuse the Phase-0 map
  component, sized for a form field); click → place/move a marker → value = GeoJSON `Point` (4326).
  Turf for nothing yet; just lng/lat → GeoJSON.
- **`GeoPolygonInput`** (`ui:widget: geoPolygon`): click to add vertices, close the ring → value =
  GeoJSON `Polygon`; **Turf.js** validates (`booleanValid`, self-intersection) and shows area
  (`turf.area`). Drawing: plan **`terra-draw`** (MapLibre-native, modern) for robustness; fall back to
  a minimal click-to-add-vertex implementation if we want zero extra deps first. See open Q3.
- **Editable JSON inspector:** a panel showing the live `jsonSchema`; editing it **re-renders** the
  form (controlled state). Invalid JSON → inline error, last good schema stays mounted.
- **Layout on the Capture route:** prompt box + inspector in a left panel; the rendered form in a
  card over the shared shell map; placing a geo-point drops a pin on that same map.

---

## 5. `/api/submissions` — persist

- `POST /api/submissions` body `{ formId, siteId?, data }`.
- Server: re-validate `data` against the stored `forms.json_schema` (AJV) — **never trust the client**;
  extract the designated geo-point; in one transaction: upsert/select the `site`, insert the
  `submission` with `data` + projected `geom` (`ST_SetSRID(ST_MakePoint(lng,lat),4326)` /
  `ST_GeomFromGeoJSON`), return the row + site.
- `GET /api/submissions?siteId=` (optional, for the demo list) returns recent submissions with
  `ST_AsGeoJSON(geom)`.

---

## 6. Capture eval suite (`src/evals/suites/capture.*`)

Registered in `src/evals/index.ts` (the Phase-0 registry already reserves the metric names).
~8 cases, each: `{ prompt, expect }` → run the generation function → deterministic checks.

| Metric | Check |
| --- | --- |
| `schema_valid` | emitted schema compiles in AJV (draft 2020-12) and passes the Zod guard |
| `field_coverage` | all field names implied by the prompt are present (case-insensitive contains) |
| `conditional_ok` | prompts implying conditionals yield `if`/`then` (or `dependencies`) |
| `geo_format_ok` | prompts implying a location yield a field with `format: geo-point`/`geo-polygon` |

- Cases mix **LLM-dependent** (most) and **2 pure-schema** cases (validate a hand-written schema
  renders + round-trips) so the suite still exercises the pipeline if the Gemini free tier is
  rate-limited. LLM cases run against `getModel()`; results written to `src/evals/results/` as in
  Phase 0. Keep N small to respect free-tier limits (cache identical prompts).

---

## 7. New dependencies (all free / open-source)

`@rjsf/core`, `@rjsf/utils`, `@rjsf/validator-ajv8`, `ajv` + `ajv-formats`, `@turf/turf` (or scoped
`@turf/area`, `@turf/boolean-valid`), and `terra-draw` (polygon drawing — pending Q3). No paid APIs.

---

## 8. Build order (maps to playbook 1.2 → 1.4)

1. `0001_capture` migration (`forms`, `submissions`) + `getDb` helpers; `db:generate` → augment →
   `db:migrate` (local docker **and** Supabase).
2. `/api/generate` + Zod meta-schema guard + retry; prompt box → schema in state → read-only inspector.
3. RJSF/AJV render + `GeoPointInput`/`GeoPolygonInput` + editable inspector + `/api/submissions` save;
   test with a field-survey prompt; pin shows on the map.
4. Capture eval suite (~8) + empty/error/mobile states; deploy (`vercel --prod`); update README.

**Definition of done:** type a survey prompt → a valid form renders with a working map location
field → submit → a `submission` row + `site` pin persists (local and on `locus-dun.vercel.app`);
`npm run eval -- --module=capture` passes.

---

## 9. Open questions

1. **Submission → site attachment.** Default **create-or-select**: a designated geo-point creates a
   new site (named from a form field), with an optional "attach to existing site" picker. Alternative:
   submissions always pick an existing site (no creation). Confirm the demo flow?
2. **Persist generated forms, or ephemeral?** Default **persist** (`forms` table → submissions
   reference `form_id`), which the data model assumes. Ephemeral (generate → fill → submit, no `forms`
   row) is simpler but loses reuse. Keep persist?
3. **Polygon drawing library.** Default **`terra-draw`** (MapLibre-native, maintained). Alternative:
   a minimal custom click-to-draw + Turf validation (zero extra deps, more code). Which?
4. **JSON-Schema subset scope.** The list in §3 — is `array`-of-objects (nested) in scope for Phase 1,
   or flat fields + simple arrays only? Default: **flat + simple arrays + `if`/`then`**; defer nested
   objects to keep RJSF widget wiring simple.
5. **Eval LLM budget.** Run the ~6 LLM cases live against Gemini free each `npm run eval`, or record
   fixtures and replay (deterministic, no tokens)? Default: **live with small N + 2 pure-schema
   cases**; add a `--record` fixture mode later if rate limits bite.
6. **Which field is the site location** when a form has multiple geo-points? Default: the **first**
   `geo-point`, overridable via `ui:options.siteLocation: true`. OK?
```
