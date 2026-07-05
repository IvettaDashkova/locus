import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { grantCredits, getBalance } from "@/lib/ai/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { sessionId } — confirm a completed Checkout on return from Stripe and credit the buyer. This
 * is the webhook-less path: it works with only STRIPE_SECRET_KEY set. It's safe because it credits
 * ONLY when the session is `paid` AND its metadata.userId matches the caller, and `grantCredits` is
 * idempotent by session id — so a real webhook (if configured) firing too can't double-credit.
 */
export async function POST(req: Request) {
  const who = await requireUser();
  if (who instanceof NextResponse) return who;
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Payments are not configured." }, { status: 503 });
  }

  let body: { sessionId?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    /* empty */
  }
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  if (!sessionId) return NextResponse.json({ error: "sessionId is required." }, { status: 400 });

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    const credits = Number(session.metadata?.credits);
    // Only credit a paid session that belongs to THIS user (never trust a client-supplied id blindly).
    if (
      session.payment_status === "paid" &&
      session.metadata?.userId === who.id &&
      Number.isInteger(credits) &&
      credits > 0
    ) {
      await grantCredits(who.id, credits, session.id); // idempotent — no double credit vs the webhook
    }
    return NextResponse.json({ balance: await getBalance(who.id) });
  } catch (e) {
    console.error("checkout confirm failed", e);
    return NextResponse.json({ error: "Could not confirm the purchase." }, { status: 502 });
  }
}
