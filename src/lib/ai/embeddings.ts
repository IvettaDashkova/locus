import { embed as aiEmbed, embedMany as aiEmbedMany } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { env } from "@/lib/env";
import { EMBEDDING } from "./embeddings.config";

/**
 * Embeddings via the Vercel AI SDK (Gemini). Hosted, so they work in serverless functions (no model
 * to load in the request path). `taskType` asymmetric embeddings improve retrieval: documents are
 * embedded as RETRIEVAL_DOCUMENT, queries as RETRIEVAL_QUERY. Output dimension = EMBEDDING.dim (768).
 */
function embeddingModel() {
  const google = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY });
  return google.textEmbedding(EMBEDDING.model);
}

type TaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

function providerOptions(taskType?: TaskType) {
  // gemini-embedding-001 supports Matryoshka truncation; cosine search is scale-invariant so the
  // truncated vector needs no renormalization.
  return { google: { outputDimensionality: EMBEDDING.dim, ...(taskType ? { taskType } : {}) } };
}

async function embedValues(values: string[], taskType?: TaskType): Promise<number[][]> {
  const { embeddings } = await aiEmbedMany({
    model: embeddingModel(),
    values,
    providerOptions: providerOptions(taskType),
  });
  return embeddings;
}

/** Generic embed (used by the foundation smoke eval). */
export async function embed(texts: string[]): Promise<number[][]> {
  return embedValues(texts);
}

export async function embedOne(text: string): Promise<number[]> {
  const { embedding } = await aiEmbed({ model: embeddingModel(), value: text, providerOptions: providerOptions() });
  return embedding;
}

/** Embed documents/passages for storage. */
export async function embedPassages(texts: string[]): Promise<number[][]> {
  return embedValues(texts, "RETRIEVAL_DOCUMENT");
}

/** Embed a search query. */
export async function embedQuery(text: string): Promise<number[]> {
  const [v] = await embedValues([text], "RETRIEVAL_QUERY");
  return v;
}
