import type Stripe from "stripe";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { grantCredits } from "@/lib/ai/credits";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook. Verifies the signature against the raw body, then on `checkout.session.completed`
 * credits the buyer (idempotently, keyed by the session id — Stripe delivers at-least-once). A 2xx
 * tells Stripe the event is handled; any other status makes it retry.
 */
export async function POST(req: Request) {
  if (!stripeConfigured() || !env.STRIPE_WEBHOOK_SECRET) {
    return new Response("Webhook not configured.", { status: 503 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature.", { status: 400 });

  const raw = await req.text(); // raw body is required for signature verification
  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(raw, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    console.error("stripe signature verification failed", e);
    return new Response("Invalid signature.", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata?.userId;
    const credits = Number(session.metadata?.credits);
    if (userId && Number.isInteger(credits) && credits > 0 && session.payment_status === "paid") {
      try {
        await grantCredits(userId, credits, session.id);
      } catch (e) {
        console.error("grantCredits failed", e);
        return new Response("Could not record purchase.", { status: 500 }); // let Stripe retry
      }
    }
  }

  return new Response("ok", { status: 200 });
}
