import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://locus:locus@localhost:5432/locus",
  },
  // PostGIS / pgvector / pg_trgm are managed by the first migration's CREATE EXTENSION, not here.
  extensionsFilters: ["postgis"],
  verbose: true,
  strict: true,
});
