-- Switch embeddings to text-embedding-004 (768-d). Old 384-d vectors can't be cast and the HNSW
-- index blocks the type change; chunks are re-created by `npm run ingest`.
DROP INDEX IF EXISTS "chunks_embedding_hnsw";--> statement-breakpoint
TRUNCATE TABLE "chunks";--> statement-breakpoint
ALTER TABLE "chunks" ALTER COLUMN "embedding" SET DATA TYPE vector(768);--> statement-breakpoint
CREATE INDEX "chunks_embedding_hnsw" ON "chunks" USING hnsw ("embedding" vector_cosine_ops);
