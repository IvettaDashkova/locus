/**
 * OpenAPI 3.0 description of the Locus HTTP API. Served as JSON at `/api/openapi` and rendered with
 * Swagger UI at `/api/docs`. Hand-authored (one source of truth) so it stays accurate without a
 * build step. Servers is relative (`/`) so the spec works on any host it's served from.
 */

const Error = {
  type: "object",
  properties: { error: { type: "string" } },
} as const;

const TrackMetrics = {
  type: "object",
  description: "Computed, grounded trajectory metrics. Distances in metres, durations in seconds, speeds in m/s.",
  properties: {
    pointCount: { type: "integer" },
    distanceM: { type: "number" },
    movingDistanceM: { type: "number" },
    durationS: { type: "number" },
    movingTimeS: { type: "number" },
    stoppedTimeS: { type: "number" },
    avgSpeedMps: { type: "number" },
    maxSpeedMps: { type: "number" },
    elevationGainM: { type: "number" },
    elevationLossM: { type: "number" },
    minElevationM: { type: "number", nullable: true },
    maxElevationM: { type: "number", nullable: true },
    stopCount: { type: "integer" },
    legCount: { type: "integer" },
  },
} as const;

const LngLat = {
  type: "array",
  description: "[longitude, latitude] in WGS84.",
  items: { type: "number" },
  minItems: 2,
  maxItems: 2,
  example: [30.5234, 50.4501],
} as const;

const TrackSummary = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    name: { type: "string" },
    description: { type: "string", nullable: true },
    activity: { type: "string", nullable: true, enum: ["walk", "hike", "run", "cycle", "drive", "boat", null] },
    source: { type: "string", enum: ["gpx", "geojson", "synthetic"] },
    startedAt: { type: "string", format: "date-time", nullable: true },
    endedAt: { type: "string", format: "date-time", nullable: true },
    metrics: { ...TrackMetrics, nullable: true },
    bbox: { type: "array", items: { type: "number" }, minItems: 4, maxItems: 4, nullable: true },
    path: { type: "object", description: "GeoJSON LineString", nullable: true, additionalProperties: true },
  },
} as const;

const ACTIVITY = { type: "string", enum: ["walk", "hike", "run", "cycle", "drive", "boat"] } as const;

export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Locus API",
    version: "1.0.0",
    description:
      "HTTP API for **Locus** — a geospatial workspace over PostGIS + pgvector. Four modules share one " +
      "datastore: Capture (NL→form), Ask (RAG), Act (agent with geo tools), and Tracks (trajectory analytics). " +
      "LLM-backed endpoints use the Gemini free tier (~20 generate requests/day); see `/api/usage`.",
    license: { name: "MIT" },
  },
  servers: [{ url: "/", description: "This host" }],
  tags: [
    { name: "System", description: "Health and quota." },
    { name: "Capture", description: "Generate forms from natural language and store submissions." },
    { name: "Ask", description: "Grounded geospatial RAG (streaming)." },
    { name: "Act", description: "Agent with geo tools (streaming)." },
    { name: "Geocoding", description: "Place / coordinate lookup." },
    { name: "Tracks", description: "GPS trajectory import, building, analytics, and playback data." },
  ],
  paths: {
    "/api/health": {
      get: {
        tags: ["System"],
        summary: "Health check",
        description: "Confirms the database is reachable and PostGIS + pgvector are installed.",
        responses: {
          "200": {
            description: "Healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { db: { type: "string", example: "ok" }, postgis: { type: "boolean" }, vector: { type: "boolean" } },
                },
              },
            },
          },
          "500": { description: "Database error", content: { "application/json": { schema: { type: "object", properties: { db: { type: "string" }, message: { type: "string" } } } } } },
        },
      },
    },
    "/api/usage": {
      get: {
        tags: ["System"],
        summary: "AI quota usage",
        description: "Best-effort tally of Gemini free-tier generate calls used today (resets at Pacific midnight).",
        responses: {
          "200": {
            description: "Usage",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    limit: { type: "integer", example: 20 },
                    used: { type: "integer" },
                    remaining: { type: "integer" },
                    day: { type: "string", example: "2026-06-28" },
                    resetsAt: { type: "string", example: "midnight America/Los_Angeles" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/generate": {
      post: {
        tags: ["Capture"],
        summary: "Generate a form schema from a prompt",
        description: "An LLM emits a field list; the result is Zod-guarded and returned as JSON Schema + UI schema. Uses one generate request.",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["prompt"], properties: { prompt: { type: "string", example: "A field survey: site name, condition rating, notes, and a location on a map." } } } } },
        },
        responses: {
          "200": { description: "Generated schema", content: { "application/json": { schema: { type: "object", properties: { jsonSchema: { type: "object", additionalProperties: true }, uiSchema: { type: "object", additionalProperties: true } } } } } },
          "400": { description: "Missing prompt", content: { "application/json": { schema: Error } } },
          "422": { description: "Could not produce a valid schema (or LLM quota exhausted)", content: { "application/json": { schema: Error } } },
        },
      },
    },
    "/api/submissions": {
      get: {
        tags: ["Capture"],
        summary: "List submissions",
        responses: {
          "200": {
            description: "Recent submissions with geometry",
            content: { "application/json": { schema: { type: "object", properties: { items: { type: "array", items: { type: "object", properties: { id: { type: "string", format: "uuid" }, formName: { type: "string" }, siteName: { type: "string", nullable: true }, data: { type: "object", additionalProperties: true }, geometry: { type: "object", nullable: true, additionalProperties: true }, createdAt: { type: "string", format: "date-time" } } } } } } } },
          },
        },
      },
      post: {
        tags: ["Capture"],
        summary: "Save a submission",
        description: "Validates `data` against `jsonSchema` (AJV). The designated geo-point creates or selects a site and is projected into PostGIS.",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["jsonSchema", "data"], properties: { name: { type: "string" }, jsonSchema: { type: "object", additionalProperties: true }, uiSchema: { type: "object", additionalProperties: true }, data: { type: "object", additionalProperties: true }, siteId: { type: "string", format: "uuid" } } } } },
        },
        responses: {
          "200": { description: "Saved", content: { "application/json": { schema: { type: "object", properties: { submissionId: { type: "string", format: "uuid" }, siteId: { type: "string", format: "uuid", nullable: true }, siteName: { type: "string", nullable: true } } } } } },
          "400": { description: "Missing/invalid body", content: { "application/json": { schema: Error } } },
          "422": { description: "Data does not match the schema", content: { "application/json": { schema: Error } } },
        },
      },
    },
    "/api/ask": {
      post: {
        tags: ["Ask"],
        summary: "Ask a grounded question (streaming)",
        description: "Hybrid retrieval over the corpus + your data, then a streamed answer grounded only in retrieved sources (cited `[n]`). Out-of-corpus questions are declined. The cited sources are returned base64-encoded in the `x-locus-sources` response header.",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["question"], properties: { question: { type: "string", example: "Which port cities are on the Baltic Sea?" } } } } } },
        responses: {
          "200": { description: "Streamed plain-text answer", content: { "text/plain": { schema: { type: "string" } } } },
          "400": { description: "Missing question" },
        },
      },
    },
    "/api/act": {
      post: {
        tags: ["Act"],
        summary: "Run an agent task (streaming NDJSON)",
        description: "An agent plans and calls real geo tools (geocode, route, isochrone, nearby, weather, elevation, sun). Streams newline-delimited JSON events: `{type:'text'|'tool'|'tool-result'|'features'|'error'|'done', ...}`.",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["task"], properties: { task: { type: "string", example: "Drive time from Kyiv to Lviv." } } } } } },
        responses: {
          "200": { description: "NDJSON event stream", content: { "application/x-ndjson": { schema: { type: "string" } } } },
          "400": { description: "Missing task" },
        },
      },
    },
    "/api/geocode": {
      get: {
        tags: ["Geocoding"],
        summary: "Place typeahead",
        description: "Autocomplete place suggestions (Photon / OSM). Returns [] for queries shorter than 2 characters.",
        parameters: [{ name: "q", in: "query", required: true, schema: { type: "string" }, example: "Kraków" }],
        responses: {
          "200": { description: "Suggestions", content: { "application/json": { schema: { type: "object", properties: { results: { type: "array", items: { type: "object", properties: { label: { type: "string" }, lng: { type: "number" }, lat: { type: "number" } } } } } } } } },
        },
      },
    },
    "/api/tracks": {
      get: {
        tags: ["Tracks"],
        summary: "List tracks",
        description: "All tracks with computed metrics, bounding box, and a simplified path for the overview map.",
        responses: { "200": { description: "Tracks", content: { "application/json": { schema: { type: "object", properties: { tracks: { type: "array", items: TrackSummary } } } } } } },
      },
      post: {
        tags: ["Tracks"],
        summary: "Import a GPX/GeoJSON track",
        description: "Parses the uploaded file content, computes metrics + segments, and persists the track.",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["content"], properties: { content: { type: "string", description: "Raw GPX XML or GeoJSON text." }, filename: { type: "string" }, name: { type: "string" } } } } } },
        responses: {
          "200": { description: "Imported", content: { "application/json": { schema: { type: "object", properties: { id: { type: "string", format: "uuid" }, name: { type: "string" }, metrics: TrackMetrics, segmentCount: { type: "integer" } } } } } },
          "400": { description: "Missing content", content: { "application/json": { schema: Error } } },
          "422": { description: "Could not parse the track", content: { "application/json": { schema: Error } } },
        },
      },
    },
    "/api/tracks/{id}": {
      get: {
        tags: ["Tracks"],
        summary: "Get a track",
        description: "One track with its ordered fixes (for playback + charts) and move/stop segments.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "Track detail", content: { "application/json": { schema: { type: "object", properties: { track: TrackSummary, points: { type: "array", items: { type: "object", properties: { seq: { type: "integer" }, ts: { type: "string", format: "date-time" }, lng: { type: "number" }, lat: { type: "number" }, elevation: { type: "number", nullable: true }, speed: { type: "number", nullable: true } } } }, segments: { type: "array", items: { type: "object", additionalProperties: true } } } } } } },
          "404": { description: "Not found", content: { "application/json": { schema: Error } } },
        },
      },
    },
    "/api/tracks/{id}/explain": {
      post: {
        tags: ["Tracks"],
        summary: "Explain a trip (streaming)",
        description: "Streams a plain-language briefing written from the track's COMPUTED metrics (the model is forbidden from inventing numbers). Uses one generate request.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "Streamed briefing", content: { "text/plain": { schema: { type: "string" } } } },
          "404": { description: "Track not found or has no metrics" },
        },
      },
    },
    "/api/tracks/heatmap": {
      get: {
        tags: ["Tracks"],
        summary: "Track density heatmap points",
        description: "A downsampled GeoJSON FeatureCollection of all track fixes, for the multi-track density heatmap.",
        responses: { "200": { description: "GeoJSON FeatureCollection", content: { "application/json": { schema: { type: "object", additionalProperties: true } } } } },
      },
    },
    "/api/tracks/build": {
      post: {
        tags: ["Tracks"],
        summary: "Build a track from a drawn route",
        description: "Turns ordered waypoints into a full track: speed/timing from the activity preset, then the same metrics + persistence path as imports. Boat routes are snapped to the marine network and routed by sea (around land).",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["activity", "waypoints"], properties: { name: { type: "string" }, activity: ACTIVITY, waypoints: { type: "array", items: LngLat, minItems: 2 } } } } } },
        responses: {
          "200": { description: "Built", content: { "application/json": { schema: { type: "object", properties: { id: { type: "string", format: "uuid" }, name: { type: "string" }, metrics: TrackMetrics } } } } },
          "400": { description: "Invalid activity", content: { "application/json": { schema: Error } } },
          "422": { description: "Fewer than two waypoints", content: { "application/json": { schema: Error } } },
        },
      },
    },
    "/api/tracks/route-preview": {
      post: {
        tags: ["Tracks"],
        summary: "Preview a route's geometry",
        description: "Returns the polyline a route would follow for the given activity — boats are routed by sea, other activities go straight — so the builder can preview it live. Geometry only; nothing is saved.",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["activity", "waypoints"], properties: { activity: ACTIVITY, waypoints: { type: "array", items: LngLat, minItems: 2 } } } } } },
        responses: { "200": { description: "Route polyline", content: { "application/json": { schema: { type: "object", properties: { path: { type: "array", items: LngLat } } } } } } },
      },
    },
  },
  components: { schemas: { Error, TrackMetrics, TrackSummary } },
} as const;

export type OpenApiSpec = typeof openapiSpec;
