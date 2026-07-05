import { getClient } from "@/db/client";

/**
 * Per-user rate limit for the AI endpoints. The daily LLM budget (`usage.ts`) is *shared* across all
 * users, so without this a single account could burn the whole day's quota in one burst — a real
 * availability problem for a public demo. This caps how fast any one user can spend it.
 *
 * Fixed-window counter in Postgres (no Redis — matches the free stack). Keyed by user id; the
 * check-and-increment is a single atomic upsert (same TOCTOU-safe pattern as `reserveAiBudget`), and
 * it fails *open* on an infra error — accounting must never hard-block a legitimate request.
 */
export const AI_RATE_LIMIT = 10; // max AI calls…
export const AI_RATE_WINDOW_S = 3600; // …per user per hour

let ensured = false;
async function ensureTable(): Promise<void> {
  if (ensured) return;
  await getClient()`CREATE TABLE IF NOT EXISTS ai_rate_limit (
    id text PRIMARY KEY,
    window_start bigint NOT NULL,
    count integer NOT NULL DEFAULT 0
  )`;
  ensured = true;
}

/**
 * Atomically count this call against the identifier's current window. Returns true if it fits under
 * `limit`, false if the identifier is over the limit for the window (caller should 429).
 */
export async function allowAiCall(
  identifier: string,
  limit = AI_RATE_LIMIT,
  windowS = AI_RATE_WINDOW_S,
): Promise<boolean> {
  try {
    await ensureTable();
    // Floor now to the window boundary so all calls in the same hour share a bucket.
    const win = Math.floor(Date.now() / 1000 / windowS) * windowS;
    // On conflict: if still in the same window, increment (guarded by the WHERE so an over-limit
    // increment writes nothing and returns no row → blocked); if the window rolled over, reset to 1.
    const rows = await getClient()<{ count: number }[]>`
      INSERT INTO ai_rate_limit (id, window_start, count) VALUES (${identifier}, ${win}, 1)
      ON CONFLICT (id) DO UPDATE SET
        window_start = ${win},
        count = CASE WHEN ai_rate_limit.window_start = ${win} THEN ai_rate_limit.count + 1 ELSE 1 END
      WHERE (CASE WHEN ai_rate_limit.window_start = ${win} THEN ai_rate_limit.count + 1 ELSE 1 END) <= ${limit}
      RETURNING count
    `;
    return rows.length > 0;
  } catch {
    return true; // fail open — never block a request on an accounting error
  }
}
