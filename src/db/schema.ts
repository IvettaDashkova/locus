import { pgTable, uuid, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { geometry } from "./types";

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
