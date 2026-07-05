import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getStripe, stripeConfigured, CREDIT_PACK } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Only allow same-origin relative return paths (defends against open-redirect via `returnTo`). */
function safeReturn(returnTo: unknown): string {
  return typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//")
    ? returnTo
    : "/capture";
}

/**
 * POST { returnTo? } → create a Stripe Checkout Session for the credit pack and return its URL. The
 * buyer's user id travels in the session metadata; the webhook credits it on completion.
 */
export async function POST(req: Request) {
  const who = await requireUser();
  if (who instanceof NextResponse) return who;

  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Payments are not configured." }, { status: 503 });
  }

  let body: { returnTo?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine */
  }
  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  const back = safeReturn(body.returnTo);

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: CREDIT_PACK.currency,
            unit_amount: CREDIT_PACK.amount,
            product_data: { name: CREDIT_PACK.label },
          },
        },
      ],
      // The webhook reads these to credit the right account with the right amount.
      metadata: { userId: who.id, credits: String(CREDIT_PACK.credits) },
      success_url: `${origin}${back}?checkout=success`,
      cancel_url: `${origin}${back}?checkout=cancel`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("checkout create failed", e);
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }
}
