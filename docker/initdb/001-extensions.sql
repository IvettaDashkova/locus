-- Runs once on first container boot (empty data dir). Idempotent regardless.
-- The same CREATE EXTENSION statements also live in the first Drizzle migration so that
-- hosted databases (Supabase/Neon), where this init script does not run, get them too.
CREATE EXTENSION IF NOT EXISTS postgis;   -- geometry / spatial
CREATE EXTENSION IF NOT EXISTS vector;    -- pgvector (semantic search, Phase 2)
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- trigram / fuzzy + keyword help (Phase 2)
