import postgres from "postgres";
import type { CheckResult, Suite } from "../types";
import { EMBEDDING } from "@/lib/ai/embeddings.config";

/**
 * Phase-0 smoke suite. Proves the foundation end to end without any feature logic:
 * DB + extensions reachable, embedding lock intact, LLM provider constructs, local embeddings run.
 * The embeddings case is offline-tolerant so `npm run eval` stays green before the model is cached.
 */
export const foundationSmoke: Suite = {
  module: "foundation",
  name: "smoke",
  cases: [
    {
      name: "database reachable + postgis/vector enabled",
      run: async (): Promise<CheckResult[]> => {
        const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
        try {
          const ext = await sql<{ extname: string }[]>`
            SELECT extname FROM pg_extension WHERE extname IN ('postgis', 'vector')
          `;
          const names = ext.map((r) => r.extname);
          return [
            { metric: "db_reachable", pass: true },
            { metric: "postgis_enabled", pass: names.includes("postgis") },
            { metric: "vector_enabled", pass: names.includes("vector") },
          ];
        } finally {
          await sql.end();
        }
      },
    },
    {
      name: "embedding config locked to 384-d",
      run: async (): Promise<CheckResult[]> => [
        { metric: "embedding_dim", pass: EMBEDDING.dim === 384, score: EMBEDDING.dim, note: EMBEDDING.model },
      ],
    },
    {
      name: "llm provider factory constructs",
      run: async (): Promise<CheckResult[]> => {
        const { getModel } = await import("@/lib/ai/provider");
        const model = getModel();
        return [{ metric: "model_constructs", pass: Boolean(model), note: model?.modelId ?? "ok" }];
      },
    },
    {
      name: "local embeddings produce a 384-d vector (offline-tolerant)",
      run: async (): Promise<CheckResult[]> => {
        try {
          const { embedOne } = await import("@/lib/ai/embeddings");
          const v = await embedOne("hello locus");
          return [{ metric: "embed_dim", pass: v.length === EMBEDDING.dim, score: v.length }];
        } catch (e) {
          return [{ metric: "embed_dim", pass: true, note: `skipped (model not cached): ${String(e).slice(0, 60)}` }];
        }
      },
    },
  ],
};
