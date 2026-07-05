import { getClient } from "@/db/client";
import { stripeConfigured } from "@/lib/stripe";

/**
 * Per-user AI credits — the paywall on top of the shared free-tier budget. A user buys a pack via
 * Stripe (test mode); each AI request spends one credit. Two lazily-created tables (same pattern as
 * `usage.ts`): `user_credits` holds the balance, `credit_purchases` records each fulfilled purchase
 * keyed by the Stripe session id so webhook retries can't double-credit.
 *
 * The paywall is only enforced when Stripe is configured (`stripeConfigured()`); otherwise the gate
 * helpers are no-ops, so the app runs exactly as before until the keys are set.
 */
let ensured = false;
async function ensureTables(): Promise<void> {
  if (ensured) return;
  const sql = getClient();
  await sql`CREATE TABLE IF NOT EXISTS user_credits (
    user_id text PRIMARY KEY,
    balance integer NOT NULL DEFAULT 0
  )`;
  await sql`CREATE TABLE IF NOT EXISTS credit_purchases (
    ref text PRIMARY KEY,
    user_id text NOT NULL,
    credits integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  ensured = true;
}

/** Current balance (0 if none / on error — the paywall fails closed, never grants free credits). */
export async function getBalance(userId: string): Promise<number> {
  try {
    await ensureTables();
    const [row] = await getClient()<{ balance: number }[]>`
      SELECT balance FROM user_credits WHERE user_id = ${userId}
    `;
    return row?.balance ?? 0;
  } catch {
    return 0;
  }
}

/** Atomically deduct one credit. Returns true only if a credit was available and spent. */
export async function consumeCredit(userId: string): Promise<boolean> {
  try {
    await ensureTables();
    const rows = await getClient()<{ balance: number }[]>`
      UPDATE user_credits SET balance = balance - 1
      WHERE user_id = ${userId} AND balance > 0
      RETURNING balance
    `;
    return rows.length > 0;
  } catch {
    return false; // fail closed — an accounting error must not hand out a free AI call
  }
}

/**
 * Credit a fulfilled purchase, idempotent by `ref` (the Stripe checkout session id). Safe against
 * Stripe's at-least-once webhook delivery: a repeated ref inserts nothing and adds no balance.
 * Does NOT swallow errors — the webhook must see a failure and let Stripe retry.
 */
export async function grantCredits(userId: string, credits: number, ref: string): Promise<void> {
  await ensureTables();
  await getClient().begin(async (tx) => {
    const inserted = await tx`
      INSERT INTO credit_purchases (ref, user_id, credits) VALUES (${ref}, ${userId}, ${credits})
      ON CONFLICT (ref) DO NOTHING
      RETURNING ref
    `;
    if (inserted.length === 0) return; // already processed this session — do not double-credit
    await tx`
      INSERT INTO user_credits (user_id, balance) VALUES (${userId}, ${credits})
      ON CONFLICT (user_id) DO UPDATE SET balance = user_credits.balance + ${credits}
    `;
  });
}

/**
 * Gate helpers for the AI routes. `creditsAvailable` is the cheap pre-check (before spending the
 * shared budget, so a broke user doesn't waste it); `spendCredit` does the atomic deduction after the
 * budget is reserved. Both are no-ops (return true) when the paywall is off.
 */
export async function creditsAvailable(userId: string): Promise<boolean> {
  if (!stripeConfigured()) return true;
  return (await getBalance(userId)) > 0;
}

export async function spendCredit(userId: string): Promise<boolean> {
  if (!stripeConfigured()) return true;
  return consumeCredit(userId);
}
