import { NextResponse } from "next/server";
import { generateForm } from "@/lib/capture/generate";
import { reserveAiBudget, markExhausted, isQuotaError } from "@/lib/ai/usage";
import { allowAiCall } from "@/lib/ai/rate-limit";
import { creditsAvailable, spendCredit } from "@/lib/ai/credits";
import { requireUser } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { prompt } → { jsonSchema, uiSchema }. The LLM emits a schema; we Zod-guard, retry once. */
export async function POST(req: Request) {
  // AI generation spends the shared daily budget — sign-in required (anonymous visitors use the demo).
  const who = await requireUser();
  if (who instanceof NextResponse) return who;
  // Per-user rate limit so one account can't burst through the shared daily budget.
  if (!(await allowAiCall(who.id))) {
    return NextResponse.json({ error: "Too many AI requests — please wait a minute and try again." }, { status: 429 });
  }

  let body: { prompt?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json({ error: "A 'prompt' string is required." }, { status: 400 });
  }
  if (prompt.length > 2000) {
    return NextResponse.json({ error: "That prompt is too long." }, { status: 413 });
  }

  // Paywall pre-check (no-op unless Stripe is configured): don't spend the shared budget for a user
  // who has no credits to cover the call.
  if (!(await creditsAvailable(who.id))) {
    return NextResponse.json({ error: "no_credits" }, { status: 402 });
  }

  // Atomically reserve one round-trip from the daily Gemini free-tier budget before spending it.
  // Open to everyone, but the reservation is race-safe so concurrent callers can't overshoot quota.
  if (!(await reserveAiBudget(1))) {
    return NextResponse.json(
      { error: "The daily AI budget is spent — it resets at midnight (America/Los_Angeles)." },
      { status: 429 },
    );
  }

  // Budget is reserved — now deduct the user's credit (atomic; guards against a concurrent spend).
  if (!(await spendCredit(who.id))) {
    return NextResponse.json({ error: "no_credits" }, { status: 402 });
  }

  const res = await generateForm(prompt); // the round-trip is already reserved above
  if (!res.ok) {
    if (isQuotaError(res.error)) void markExhausted();
    return NextResponse.json({ error: `Could not generate a valid schema: ${res.error}` }, { status: 422 });
  }
  return NextResponse.json({ jsonSchema: res.jsonSchema, uiSchema: res.uiSchema });
}
