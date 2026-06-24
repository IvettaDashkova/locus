import { env } from "@/lib/env";

/**
 * Single source of truth for the embedding lock. A model swap is a config change + a re-embed
 * script — never a schema migration:
 *   - dim is LOCKED at 384 -> the `vector(384)` column.
 *   - default model `multilingual-e5-small` (384-d) retrieves well across en/uk/pl, matching the
 *     app's languages. `bge-small-en-v1.5` (also 384-d) is the English-only alternative.
 * Phase 2's `chunks` table stores `embedding_model` per row, so mixed-model corpora stay
 * unambiguous and re-embeds are incremental.
 *
 * e5 models expect asymmetric prefixes: passages embedded as "passage: …", queries as "query: …".
 */
const isE5 = env.EMBEDDINGS_MODEL.includes("e5");

export const EMBEDDING = {
  model: env.EMBEDDINGS_MODEL, // default "Xenova/multilingual-e5-small"
  dim: 384, // LOCKED
  queryPrefix: isE5 ? "query: " : "",
  passagePrefix: isE5 ? "passage: " : "",
} as const;
