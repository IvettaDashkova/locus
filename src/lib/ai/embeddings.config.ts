import { env } from "@/lib/env";

/**
 * Single source of truth for the embedding lock. A model swap is a config change + a re-embed
 * script — never a schema migration:
 *   - dim is LOCKED at 384 -> the `vector(384)` column (Phase 2).
 *   - default model `bge-small-en-v1.5` is strong-for-size, runs free locally via Transformers.js.
 *   - multilingual fallback `Xenova/multilingual-e5-small` is ALSO 384-d, so it drops into the same
 *     column for PL/UK content with no schema change.
 * Phase 2's `chunks` table also stores `embedding_model` per row, so mixed-model corpora stay
 * unambiguous and re-embeds are incremental.
 */
export const EMBEDDING = {
  model: env.EMBEDDINGS_MODEL, // default "Xenova/bge-small-en-v1.5"
  dim: 384, // LOCKED
} as const;
