import { z } from "zod";

/**
 * Server-side environment. Validated lazily on first access (via a Proxy) so that node scripts
 * which load `.env.local` through dotenv *before* using any value don't trip over ES-module
 * import ordering. In the Next.js app, process.env is already populated at access time.
 *
 * Never import this from a client component — it reads server-only secrets.
 */
const schema = z.object({
  // Database (local docker, or Supabase/Neon pooler)
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // LLM provider (AI SDK swaps them — see lib/ai/provider.ts)
  LLM_PROVIDER: z.enum(["gemini", "ollama"]).default("gemini"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  OLLAMA_BASE_URL: z.string().default("http://localhost:11434"),
  OLLAMA_MODEL: z.string().default("llama3.1"),

  // Embeddings via the AI SDK (Gemini). Dimension is pinned in embeddings.config.ts.
  EMBEDDINGS_MODEL: z.string().default("gemini-embedding-001"),

  // Geo tools (Phase 3)
  ORS_API_KEY: z.string().optional(),

  // Tracing (optional — no-op if unset)
  LANGFUSE_PUBLIC_KEY: z.string().optional(),
  LANGFUSE_SECRET_KEY: z.string().optional(),
  LANGFUSE_BASEURL: z.string().default("https://cloud.langfuse.com"),

  // Payments (Stripe test mode). When unset, the credit paywall is OFF and the AI endpoints behave as
  // before (shared free-tier budget only). Set both to turn the per-user credit paywall on.
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let parsed: Env | null = null;
function load(): Env {
  if (parsed) return parsed;
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment:\n${issues}`);
  }
  parsed = result.data;
  return parsed;
}

export const env = new Proxy({} as Env, {
  get: (_target, prop: string) => load()[prop as keyof Env],
});
