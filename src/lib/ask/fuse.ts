/**
 * Reciprocal-rank fusion — pure, dependency-free, so it unit-tests without a DB or the embedding
 * model (which validates env at import). `retrieve.ts` re-exports `fuseRrf` and uses it over the
 * vector- and keyword-ranked chunk lists.
 */

const RRF_K = 60;

/**
 * Fuse a vector-ranked and a keyword-ranked list, returning the top-`k` by fused score. Each list
 * contributes `1/(RRF_K + rank)` to a row's score; rows present in both are summed. `similarity` is
 * preserved from the vector list (keyword-only rows get 0) so the caller's grounding gate can
 * distinguish a true semantic hit from a keyword-only match.
 */
export function fuseRrf<T extends { id: string; similarity?: number }>(
  vRows: T[],
  kRows: T[],
  k: number,
): { row: T; score: number; similarity: number }[] {
  const fused = new Map<string, { row: T; score: number; similarity: number }>();
  vRows.forEach((row, i) => {
    fused.set(row.id, { row, score: 1 / (RRF_K + i + 1), similarity: Number(row.similarity ?? 0) });
  });
  kRows.forEach((row, i) => {
    const inc = 1 / (RRF_K + i + 1);
    const existing = fused.get(row.id);
    if (existing) existing.score += inc;
    else fused.set(row.id, { row, score: inc, similarity: 0 });
  });
  return [...fused.values()].sort((a, b) => b.score - a.score).slice(0, k);
}
