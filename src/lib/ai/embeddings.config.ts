import { env } from "@/lib/env";

/**
 * Embedding config. Embeddings run through the Vercel AI SDK provider (Gemini `text-embedding-004`,
 * free tier, multilingual) so they work reliably in serverless functions — local ONNX models fail to
 * load there. The model is one swappable constant (like the LLM); `chunks.embedding_model` is pinned
 * per row, so a model swap is a config change + a re-ingest, not a code change.
 */
export const EMBEDDING = {
  model: env.EMBEDDINGS_MODEL, // default "text-embedding-004"
  dim: 768, // LOCKED -> vector(768)
} as const;
