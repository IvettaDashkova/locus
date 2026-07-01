import { getClient } from "@/db/client";
import { embedQuery } from "@/lib/ai/embeddings";
import { fuseRrf } from "./fuse";

export { fuseRrf } from "./fuse";

export type RetrievedChunk = {
  id: string;
  source: string;
  entryId: string;
  title: string | null;
  content: string;
  url: string | null;
  license: string | null;
  coords: [number, number] | null;
  similarity: number; // cosine similarity (0..1) from the vector search, or 0 if keyword-only
  score: number; // fused RRF score
};

export type RetrieveOptions = {
  k?: number;
  candidates?: number;
  near?: { lng: number; lat: number; radiusM: number };
};

type Row = {
  id: string;
  source: string;
  entry_id: string;
  title: string | null;
  content: string;
  url: string | null;
  license: string | null;
  geom: string | null;
  similarity?: number;
};


/**
 * Hybrid retrieval over `chunks`: pgvector cosine (HNSW) ∪ tsvector keyword, fused with
 * reciprocal-rank fusion, with an optional PostGIS proximity filter. Returns the top-k chunks plus
 * the best vector similarity (used by the route's grounding guardrail).
 */
export async function retrieve(
  question: string,
  { k = 6, candidates = 20, near }: RetrieveOptions = {},
): Promise<{ chunks: RetrievedChunk[]; topSimilarity: number }> {
  const sql = getClient();
  const q = await embedQuery(question);
  const vec = `[${q.join(",")}]`;

  const spatial = near
    ? sql`AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(${near.lng}, ${near.lat}), 4326)::geography, ${near.radiusM})`
    : sql``;

  // Raise HNSW `ef_search` for this query only (SET LOCAL is transaction-scoped). The default (40)
  // under-explores the graph at our candidate count, silently degrading recall — and the grounding
  // guardrail downstream is only as good as this recall. Keep ef_search >= candidates.
  const vRows = await sql.begin(async (tx) => {
    // `set_config(..., true)` is the parameterizable, transaction-local form of SET LOCAL.
    await tx`SELECT set_config('hnsw.ef_search', ${String(Math.max(100, candidates))}, true)`;
    return tx<Row[]>`
      SELECT id, source, entry_id, title, content, url, license, ST_AsGeoJSON(geom) AS geom,
             1 - (embedding <=> ${vec}::vector) AS similarity
      FROM chunks
      WHERE TRUE ${spatial}
      ORDER BY embedding <=> ${vec}::vector
      LIMIT ${candidates}
    `;
  });

  const kRows = await sql<Row[]>`
    SELECT id, source, entry_id, title, content, url, license, ST_AsGeoJSON(geom) AS geom
    FROM chunks
    WHERE tsv @@ websearch_to_tsquery('simple', ${question}) ${spatial}
    ORDER BY ts_rank_cd(tsv, websearch_to_tsquery('simple', ${question})) DESC
    LIMIT ${candidates}
  `;

  // Reciprocal-rank fusion of the two ranked lists.
  const ranked = fuseRrf(vRows, kRows, k);
  // Grounding signal taken over the chunks we actually return (and send to the model), not the raw
  // vector top-1 — a strong vector hit that fusion drops out of the top-k must not pass the gate for
  // context the model never sees, and a keyword-only chunk (similarity 0) must not look "grounded".
  const topSimilarity = ranked.reduce((max, r) => Math.max(max, r.similarity), 0);

  return {
    topSimilarity,
    chunks: ranked.map(({ row, score, similarity }) => ({
      id: row.id,
      source: row.source,
      entryId: row.entry_id,
      title: row.title,
      content: row.content,
      url: row.url,
      license: row.license,
      coords: row.geom ? (JSON.parse(row.geom).coordinates as [number, number]) : null,
      similarity,
      score,
    })),
  };
}
