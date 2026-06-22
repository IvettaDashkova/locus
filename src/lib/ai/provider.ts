import { google } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { env } from "@/lib/env";

/**
 * The one place that knows which LLM provider is active. Every module calls getModel() and passes
 * the result to the Vercel AI SDK (generateText / streamText / tool-calling). Swapping to a paid
 * model later (e.g. Claude via @ai-sdk/anthropic) is a one-line change here.
 *
 *  - gemini: Google AI Studio free tier (hosted demo).
 *  - ollama: fully local, via Ollama's OpenAI-compatible endpoint (no key).
 */
export function getModel() {
  if (env.LLM_PROVIDER === "ollama") {
    const ollama = createOpenAICompatible({
      name: "ollama",
      baseURL: `${env.OLLAMA_BASE_URL}/v1`,
    });
    return ollama(env.OLLAMA_MODEL);
  }
  return google(env.GEMINI_MODEL);
}
