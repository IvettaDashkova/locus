import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";
import { EMBEDDING } from "./embeddings.config";

/**
 * Local, in-process embeddings via Transformers.js — no API key, no cost, no rate limit.
 * The model loads once (downloaded + cached on first use) and is reused across calls.
 * Vectors are mean-pooled + L2-normalized, length === EMBEDDING.dim (384).
 */
let extractor: Promise<FeatureExtractionPipeline> | null = null;

function getExtractor() {
  extractor ??= pipeline("feature-extraction", EMBEDDING.model);
  return extractor;
}

export async function embed(texts: string[]): Promise<number[][]> {
  const extract = await getExtractor();
  const output = await extract(texts, { pooling: "mean", normalize: true });
  return output.tolist() as number[][];
}

export async function embedOne(text: string): Promise<number[]> {
  const [vector] = await embed([text]);
  return vector;
}
