import { pgTable, uuid, text, jsonb, timestamp, integer, doublePrecision, index } from "drizzle-orm/pg-core";
import { geometry, geographyPoint, lineString, geometryAny, vector } from "./types";

/**
 * `sites` — the anchor table for the whole app. Capture submissions, Ask chunks, and Tracks all
 * relate (FK or spatially) back to a site. Every site pins to a single Point; if a site ever needs
 * an extent, add a nullable `area geometry(Polygon,4326)` column later (additive migration).
 */
export const sites = pgTable(
  "sites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category"), // domain-agnostic label
    geom: geometry("geom").notNull(), // POINT, SRID 4326
    properties: jsonb("properties").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("sites_geom_gist").using("gist", t.geom)],
);

export type Site = typeof sites.$inferSelect;
export type NewSite = typeof sites.$inferInsert;

/**
 * `forms` — a generated (NL → JSON Schema) form definition. Persisted so one form yields many
 * submissions and can be reloaded. `json_schema` is the validated schema; `ui_schema` carries
 * widget hints (which fields are geo-point/geo-polygon, which one is the site location).
 */
export const forms = pgTable("forms", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  jsonSchema: jsonb("json_schema").$type<Record<string, unknown>>().notNull(),
  uiSchema: jsonb("ui_schema").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Form = typeof forms.$inferSelect;
export type NewForm = typeof forms.$inferInsert;

/**
 * `submissions` — one filled-in form. `data` (the exact RJSF formData incl. GeoJSON) is the source
 * of truth; the designated geo-point is additionally projected into `geom` (PostGIS) so submissions
 * are spatially queryable. Anchored to a `site` (created-or-selected on save); `site_id` is nullable
 * for forms without a location field.
 */
export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").references(() => sites.id, { onDelete: "set null" }),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    geom: geometry("geom"), // projected primary geo-point, SRID 4326 (nullable)
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("submissions_geom_gist").using("gist", t.geom),
    index("submissions_site_idx").on(t.siteId),
    index("submissions_form_idx").on(t.formId),
  ],
);

export type Submission = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;

/**
 * `chunks` — the Ask (Phase 2) retrieval store: one row per chunked passage from the corpus or
 * captured data. Three search modalities on one table: `embedding` (pgvector, semantic), `tsv`
 * (tsvector, keyword — added as a generated column in the migration), `geom` (PostGIS, spatial).
 * `embedding_model` is pinned per row so mixed-model corpora stay unambiguous.
 */
export const chunks = pgTable(
  "chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source").notNull(), // 'wikivoyage' | 'osm' | 'site' | 'submission'
    entryId: text("entry_id").notNull(), // stable id within the source
    chunkIndex: integer("chunk_index").notNull().default(0),
    siteId: uuid("site_id").references(() => sites.id, { onDelete: "set null" }),
    title: text("title"),
    content: text("content").notNull(), // the only text the LLM sees
    url: text("url"),
    embedding: vector(768)("embedding").notNull(),
    embeddingModel: text("embedding_model").notNull(),
    geom: geometry("geom"), // where the chunk is "about", when known (nullable)
    license: text("license"), // 'CC-BY-SA' | 'ODbL' | 'internal'
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("chunks_geom_gist").using("gist", t.geom),
    index("chunks_source_entry").on(t.source, t.entryId),
  ],
);

export type Chunk = typeof chunks.$inferSelect;
export type NewChunk = typeof chunks.$inferInsert;

/**
 * Computed, grounded trajectory metrics (Phase 4). Stored on `tracks.metrics` so the list/summary
 * UI and the "explain this trip" prompt read pre-computed numbers — the LLM never does arithmetic.
 * All distances in metres, durations in seconds, speeds in m/s, elevation in metres. Computed by
 * `src/lib/tracks/metrics.ts` from the ordered `track_points`.
 */
export type TrackMetrics = {
  pointCount: number;
  distanceM: number; // total distance over the ground
  movingDistanceM: number; // distance excluding stopped spans
  durationS: number; // wall-clock end − start
  movingTimeS: number;
  stoppedTimeS: number;
  avgSpeedMps: number; // movingDistance / movingTime
  maxSpeedMps: number;
  elevationGainM: number;
  elevationLossM: number;
  minElevationM: number | null;
  maxElevationM: number | null;
  stopCount: number;
  legCount: number;
};

/**
 * `tracks` — one GPS trajectory (imported GPX/GeoJSON or synthetic). The ordered fixes live in
 * `track_points`; `path` is a simplified LineString for rendering and `metrics` holds the computed
 * summary. Optionally anchored to a `site` (e.g. a trailhead the track starts from).
 */
export const tracks = pgTable(
  "tracks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    activity: text("activity"), // 'walk' | 'hike' | 'run' | 'cycle' | 'drive' | 'boat'
    source: text("source").notNull(), // 'gpx' | 'geojson' | 'synthetic'
    siteId: uuid("site_id").references(() => sites.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    path: lineString("path"), // simplified, SRID 4326 (nullable until computed)
    metrics: jsonb("metrics").$type<TrackMetrics>(),
    properties: jsonb("properties").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("tracks_path_gist").using("gist", t.path),
    index("tracks_site_idx").on(t.siteId),
  ],
);

export type Track = typeof tracks.$inferSelect;
export type NewTrack = typeof tracks.$inferInsert;

/**
 * `track_points` — the ordered GPS fixes of a track. `geom` is geography(Point) so PostGIS measures
 * distance on the spheroid in metres. `seq` gives a stable order even if timestamps tie.
 */
export const trackPoints = pgTable(
  "track_points",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trackId: uuid("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    ts: timestamp("ts", { withTimezone: true }).notNull(),
    geom: geographyPoint("geom").notNull(), // POINT, SRID 4326 (geography)
    elevation: doublePrecision("elevation"), // metres above sea level (nullable)
    speed: doublePrecision("speed"), // m/s — computed at import, else null
  },
  (t) => [
    index("track_points_track_seq").on(t.trackId, t.seq),
    index("track_points_geom_gist").using("gist", t.geom),
  ],
);

export type TrackPoint = typeof trackPoints.$inferSelect;
export type NewTrackPoint = typeof trackPoints.$inferInsert;

/**
 * `segments` — a track split into alternating legs: `move` (a travelled LineString) and `stop`
 * (a dwell at one clustered Point). Produced by stop-detection (spatial+temporal clustering, see
 * `src/lib/tracks/metrics.ts`); persisted so playback and charts read them directly.
 */
export const segments = pgTable(
  "segments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trackId: uuid("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // 'move' | 'stop'
    seq: integer("seq").notNull(), // order within the track
    startSeq: integer("start_seq").notNull(), // index into track_points
    endSeq: integer("end_seq").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }).notNull(),
    distanceM: doublePrecision("distance_m"),
    durationS: doublePrecision("duration_s"),
    geom: geometryAny("geom"), // LineString for 'move', Point for 'stop'
    properties: jsonb("properties").$type<Record<string, unknown>>().default({}),
  },
  (t) => [
    index("segments_track_seq").on(t.trackId, t.seq),
    index("segments_geom_gist").using("gist", t.geom),
  ],
);

export type Segment = typeof segments.$inferSelect;
export type NewSegment = typeof segments.$inferInsert;
