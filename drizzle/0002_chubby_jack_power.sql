CREATE TABLE "chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"entry_id" text NOT NULL,
	"chunk_index" integer DEFAULT 0 NOT NULL,
	"site_id" uuid,
	"title" text,
	"content" text NOT NULL,
	"url" text,
	"embedding" vector(384) NOT NULL,
	"embedding_model" text NOT NULL,
	"geom" geometry(Point, 4326),
	"license" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chunks_geom_gist" ON "chunks" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "chunks_source_entry" ON "chunks" USING btree ("source","entry_id");--> statement-breakpoint
-- Keyword search: generated tsvector ('simple' config — no English-only stemming, multilingual-safe).
ALTER TABLE "chunks" ADD COLUMN "tsv" tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce("title", '') || ' ' || "content")) STORED;--> statement-breakpoint
CREATE INDEX "chunks_tsv_gin" ON "chunks" USING gin ("tsv");--> statement-breakpoint
-- Semantic search: HNSW over cosine distance (pgvector).
CREATE INDEX "chunks_embedding_hnsw" ON "chunks" USING hnsw ("embedding" vector_cosine_ops);