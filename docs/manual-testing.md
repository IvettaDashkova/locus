# Manual testing guide

A click-through to exercise every module by hand. Steps that hit the LLM (Capture generate, Ask,
Act, evals) need Gemini quota — the `gemini-2.5-flash` **free tier is ~20 requests/day**, so if you
see `quota` / 429 errors, wait for the daily reset or use a second key / `LLM_PROVIDER=ollama`.

## 0. Bring the app up

```bash
npm run db:up          # local Postgres (PostGIS + pgvector) on :5433, or point DATABASE_URL at Supabase
npm run db:migrate     # apply schema (extensions, tables, indexes)
npm run seed           # sample sites
npm run seed:tracks    # synthetic GPS tracks for the Tracks module (no LLM)
npm run ingest         # embed + load the sample corpus (needs quota — ~1 batch of embeddings)
npm run dev            # http://localhost:3000
```

Quick health check (no LLM): `curl -s localhost:3000/api/health` → `{"ok":true,...}`.

The live demo is also always on: **https://locus-dun.vercel.app**.

---

## 1. Capture — NL → form → geo data

1. Open `/capture`. Confirm the map + **+ New form** button render (dark theme by default).
2. Click **+ New form**, type a prompt, e.g.
   *"Field survey of a storefront: site name, condition rating 1–5, notes, photo URL, and the location on a map."*
3. Click **Generate**. Expect: a JSON-Schema inspector populates and a form renders with the
   fields, including a **map widget** for the location (geo-point).
4. Click the embedded map to drop a pin → marker + `lng/lat` appear.
5. Click **Save submission** → green `Saved ✓ … site …`. The slide-over closes, a **pin appears on
   the main map**, and the submission shows in the right-hand list. Hover the pin → tooltip with the
   form data. Click a list item → detail view.
6. **Polygon variant:** prompt *"…and the boundary of the surveyed area"* → a geo-polygon
   (terra-draw) widget renders; draw a polygon, save, confirm the filled area on the map.

**Probe:** save with the required geo field empty → currently allowed (known low-sev gap); save with
a 1–5 rating out of range → AJV flags it.

---

## 2. Ask — geospatial RAG

1. Open `/ask`, click the **Ask** button (right-side slide-over).
2. In-corpus question: *"Which port cities are on the Baltic Sea?"* → expect a concise answer that
   **cites only the sources it used** `[1][2]`, plus **pins on the map** for the mentioned places.
3. Multilingual: *"столиця Польщі на Віслі"* → answers about Warsaw (uk query, latin/uk labels).
4. **Grounding probe:** out-of-corpus *"how do I bake sourdough bread"* → it should **decline**
   (similarity below the τ=0.6 gate), not hallucinate.

---

## 3. Act — agent with geo tools

Open `/act`, click **Act**, then try (each streams the plan, tool chips, and map features live):

| Task | Expected tool chain | Answer should contain |
| --- | --- | --- |
| "How long to drive from Kyiv to Lviv, and how far?" | geocode → geocode → route | a distance + duration (from the tool, not invented) |
| "Find cafes within 400 m of the Eiffel Tower." | geocode → places_nearby | nearby cafés / a count + markers |
| "Weather right now in Gdansk?" | geocode → weather | a temperature |
| "Sunset today in Lviv?" | geocode → sun_times | a time |
| "Area reachable in 15 min walking from central Riga." | geocode → isochrone | an isochrone polygon on the map |

**What to watch:** the agent **geocodes before** routing/weather (never invents coordinates), draws
results on the shared map, and stops when done. Try a 2-hop task ("drive from X to Y") to see
multi-step orchestration.

---

## 4. MCP server (Claude Desktop)

The same seven tools, exposed over stdio — no LLM quota needed (the tools call OSM / Open-Meteo / ORS).

```bash
npm run mcp     # stdio server; set ORS_API_KEY for route/isochrone
```

Smoke test without a client:

```bash
# initialize → tools/list → call sun_times, over stdio
node -e '
const {spawn}=require("child_process");
const p=spawn("npx",["tsx","packages/locus-mcp/src/server.ts"]);
let o="";p.stdout.on("data",d=>o+=d);
const s=x=>p.stdin.write(JSON.stringify(x)+"\n");
setTimeout(()=>s({jsonrpc:"2.0",id:1,method:"initialize",params:{protocolVersion:"2024-11-05",capabilities:{},clientInfo:{name:"t",version:"1"}}}),800);
setTimeout(()=>{s({jsonrpc:"2.0",method:"notifications/initialized"});s({jsonrpc:"2.0",id:2,method:"tools/list"});},1400);
setTimeout(()=>s({jsonrpc:"2.0",id:3,method:"tools/call",params:{name:"sun_times",arguments:{lat:50.45,lng:30.52}}}),1900);
setTimeout(()=>{console.log(o);p.kill();},4000);'
```

Expect `tools/list` → all 7 names, and `tools/call sun_times` → a sunrise/sunset line. For Claude
Desktop, follow [`docs/claude-desktop.md`](./claude-desktop.md).

---

## 5. Langfuse tracing

With `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` set, run **one Act task** (section 3), then open
your Langfuse project → **Traces**. Expect a trace named `act-agent` with nested generation +
tool-call spans and the task in metadata. (Tracing is opt-in and no-ops when keys are absent.)

Verify the trace landed via API (no dashboard needed):

```bash
PK=$LANGFUSE_PUBLIC_KEY; SK=$LANGFUSE_SECRET_KEY; BASE=${LANGFUSE_BASEURL:-https://cloud.langfuse.com}
curl -s -u "$PK:$SK" "$BASE/api/public/traces?limit=3" | jq '.data[].name'
```

---

## 6. Evals

```bash
npm run eval                    # all suites
npm run eval -- --module=act    # just the Act agent suite (5 tasks × 4 metrics, throttled 22s/case)
npm run eval -- --module=ask    # retrieval recall@k + grounding/refusal
```

Quota/rate errors are reported as `skipped: LLM unavailable` (counted as pass) so the run stays
green when the free tier is down — real passes need available quota. Results are written to
`src/evals/results/<timestamp>.jsonl`.

---

## 7. Tracks — trajectory analytics

Most of this needs **no LLM** (metrics, playback, routing are all computed) — only *Explain this
trip* hits Gemini. Run `npm run seed:tracks` first so the list isn't empty.

**a. Browse + analyze a seeded track**
1. Open `/tracks`. The slide-over lists 5 sample tracks (walk / hike / cycle / drive / boat) with
   distance · time · stops. The map shows faint overview lines for all of them.
2. Click **Ridge trail hike** (richest data). Expect: the map zooms to it, draws the path with
   **amber stop markers**, and the sidebar shows metric cards (distance, moving time, avg/max speed,
   ascent, stops), an **elevation profile**, a **speed profile**, and a **move/stop timeline**.
3. **Playback:** press ▶ on the bottom bar. A marker animates along the path and **lingers at the
   stops** (time-based playback); the chart cursors track it. Drag the scrubber to seek.

**b. Build a route by clicking the map**  ← the part that's easy to miss
1. Back to **All tracks** → **Build route**. A *"Click the map to add a point"* pill appears over
   the map. Pick an **activity** (sets speed/cadence) and a name.
2. **Click the map** several times → numbered waypoints + a dashed line appear; the counter rises.
   **Undo** removes the last; **Clear** resets.
3. Or add points precisely with the **search field**: type a city (e.g. *Kraków*) and pick from the
   dropdown — the map flies there and drops the point — or type **`lat, lng`** (e.g. `50.45, 30.52`)
   and choose "Use coordinates". (Many cities share a name — check the region in the suggestion.)
4. **Save route** → it's turned into a full track and opens its analysis (ascent shows 0 m and the
   elevation chart hides — a drawn route has no known terrain, by design).

**c. Boat routes go by sea** (the around-land routing)
1. Build a route, activity **Boat**. Add two points with land between them — e.g. coordinates
   `38.6, -9.6` (Lisbon) then `41.3, 2.6` (Barcelona).
2. **Save** → the saved path **rounds Iberia through the Strait of Gibraltar** (~1850 km) instead of
   cutting across Spain. It follows the sea. (Other activities go straight as drawn.)
3. *Limit:* the marine network is open-sea resolution — two points very close together inside one
   harbour fall back to a straight hop.

**d. Import a file**
- **Build route** is for drawing; **Import track** takes a real **GPX or GeoJSON** file. Export a
  GPX from Strava/Garmin/phone (or any `.geojson` LineString) → metrics + segments compute on import.

**e. Density heatmap** — on the **All tracks** view, toggle **Heatmap** to see where tracks overlap
(most visible zoomed into one region, since the samples are spread worldwide).

**f. Explain this trip** *(needs Gemini quota)* — open a track → **Explain this trip**. A short
briefing streams in, written **from the computed metrics** (it must not invent numbers). With no
quota it shows a 429 — that's the only LLM-dependent part of Tracks.

**API smoke (no browser):**
```bash
curl -s localhost:3000/api/tracks | jq '.tracks[].name'                 # list
curl -s -X POST localhost:3000/api/tracks/build -H 'content-type: application/json' \
  -d '{"name":"sea test","activity":"boat","waypoints":[[-9.6,38.6],[2.6,41.2]]}' \
  | jq '.metrics.distanceM'                                              # ~1.57e6 m (sea), not ~1.08e6 (straight)
```

---

## 8. Cross-cutting

- **Onboarding:** on a first visit a 4-step spotlight tour auto-runs (welcome → modules → the shared
  interactive map → status/settings). Replay it anytime with the **?** button in the top bar. To see
  it again, clear the `locus:onboarding:v1` localStorage key (or use a private window).
- **Theme:** top-bar sun/moon toggles light/dark; the basemap swaps positron/dark and the view is
  preserved. Default is dark.
- **Language:** top-bar switcher (en/uk/pl); auto-detects from the browser; map place-name labels
  follow the choice. The Tracks builder, search, and tour are all localized.
- **Mobile:** narrow the window — the module nav collapses to a sheet, slide-overs go full-width.
