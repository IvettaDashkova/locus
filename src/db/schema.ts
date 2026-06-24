import { pgTable, uuid, text, jsonb, timestamp, integer, index } from "drizzle-orm/pg-core";
import { geometry, vector } from "./types";

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
    embedding: vector(384)("embedding").notNull(),
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
