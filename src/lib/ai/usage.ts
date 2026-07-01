import { getClient } from "@/db/client";

/**
 * Best-effort accounting of LLM text-generation calls against the Gemini free tier.
 * The `gemini-2.5-flash` free tier caps `generate_content` at ~20 requests/day per project; once
 * spent, every Ask/Act/Capture-generate call 429s until the daily reset. We tally the calls we make
 * (one per model round-trip / agent step) so the UI can show how many are left. It's an estimate —
 * Google is the source of truth — but it tracks closely in normal use. Embeddings use a separate
 * model/quota and are NOT counted here.
 */
export const DAILY_LIMIT = 20;

let ensured = false;
async function ensureTable(): Promise<void> {
  if (ensured) return;
  await getClient()`CREATE TABLE IF NOT EXISTS ai_usage (day text PRIMARY KEY, count integer NOT NULL DEFAULT 0)`;
  ensured = true;
}

/** Google's free tier resets at Pacific midnight — key by the LA calendar day so our counter aligns. */
function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
}

/**
 * Atomically reserve `calls` against today's budget *before* spending them. Returns true if the
 * reservation fit under `DAILY_LIMIT` (caller may proceed), false if it would exceed it (caller
 * should 429). This closes the TOCTOU race in the old read-then-write flow, where concurrent
 * requests could all observe `remaining > 0` and overshoot Google's real quota: the `WHERE` guard on
 * the upsert makes the check-and-increment a single atomic statement. Fails *open* (returns true) on
 * an infra error — accounting must never hard-block a request — matching `recordAiUsage`'s contract.
 */
export async function reserveAiBudget(calls = 1): Promise<boolean> {
  if (calls <= 0) return true;
  try {
    await ensureTable();
    const day = today();
    const rows = await getClient()<{ count: number }[]>`
      INSERT INTO ai_usage (day, count) VALUES (${day}, ${calls})
      ON CONFLICT (day) DO UPDATE SET count = ai_usage.count + ${calls}
        WHERE ai_usage.count + ${calls} <= ${DAILY_LIMIT}
      RETURNING count
    `;
    return rows.length > 0;
  } catch {
    return true; // fail open — never block a request on an accounting error
  }
}

/** Add `calls` model round-trips to today's tally. Never throws — usage accounting must not break a request. */
export async function recordAiUsage(calls = 1): Promise<void> {
  if (calls <= 0) return;
  try {
    await ensureTable();
    const day = today();
    await getClient()`
      INSERT INTO ai_usage (day, count) VALUES (${day}, ${calls})
      ON CONFLICT (day) DO UPDATE SET count = ai_usage.count + ${calls}
    `;
  } catch {
    /* ignore — accounting is best-effort */
  }
}

/** A real free-tier 429 means Google considers today spent — pin the counter to the limit so the UI
 *  self-corrects even if our tally undercounted (e.g. usage from before this counter existed). */
export async function markExhausted(): Promise<void> {
  try {
    await ensureTable();
    const day = today();
    await getClient()`
      INSERT INTO ai_usage (day, count) VALUES (${day}, ${DAILY_LIMIT})
      ON CONFLICT (day) DO UPDATE SET count = GREATEST(ai_usage.count, ${DAILY_LIMIT})
    `;
  } catch {
    /* ignore */
  }
}

/** Does an error message look like a Gemini quota / rate-limit refusal? */
export function isQuotaError(message: string): boolean {
  return /quota|exceeded your current quota|resource_exhausted|free_tier|too many requests|\b429\b/i.test(message);
}

export type AiUsage = {
  limit: number;
  used: number;
  remaining: number;
  day: string;
  /** Where the daily quota resets, for the UI tooltip. */
  resetsAt: string;
};

export async function getAiUsage(): Promise<AiUsage> {
  const day = today();
  let used = 0;
  try {
    await ensureTable();
    const rows = await getClient()<{ count: number }[]>`SELECT count FROM ai_usage WHERE day = ${day}`;
    used = Number(rows[0]?.count ?? 0);
  } catch {
    used = 0;
  }
  return {
    limit: DAILY_LIMIT,
    used,
    remaining: Math.max(0, DAILY_LIMIT - used),
    day,
    resetsAt: "midnight America/Los_Angeles",
  };
}
