import { getClient } from "@/db/client";
import { embedQuery } from "@/lib/ai/embeddings";

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

const RRF_K = 60;

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

  const vRows = await sql<Row[]>`
    SELECT id, source, entry_id, title, content, url, license, ST_AsGeoJSON(geom) AS geom,
           1 - (embedding <=> ${vec}::vector) AS similarity
    FROM chunks
    WHERE TRUE ${spatial}
    ORDER BY embedding <=> ${vec}::vector
    LIMIT ${candidates}
  `;

  const kRows = await sql<Row[]>`
    SELECT id, source, entry_id, title, content, url, license, ST_AsGeoJSON(geom) AS geom
    FROM chunks
    WHERE tsv @@ websearch_to_tsquery('simple', ${question}) ${spatial}
    ORDER BY ts_rank_cd(tsv, websearch_to_tsquery('simple', ${question})) DESC
    LIMIT ${candidates}
  `;

  // Reciprocal-rank fusion of the two ranked lists.
  const fused = new Map<string, { row: Row; score: number; similarity: number }>();
  vRows.forEach((row, i) => {
    fused.set(row.id, { row, score: 1 / (RRF_K + i + 1), similarity: Number(row.similarity ?? 0) });
  });
  kRows.forEach((row, i) => {
    const inc = 1 / (RRF_K + i + 1);
    const existing = fused.get(row.id);
    if (existing) existing.score += inc;
    else fused.set(row.id, { row, score: inc, similarity: 0 });
  });

  const ranked = [...fused.values()].sort((a, b) => b.score - a.score).slice(0, k);
  const topSimilarity = vRows.length ? Number(vRows[0].similarity ?? 0) : 0;

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
