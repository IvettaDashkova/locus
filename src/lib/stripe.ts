import Stripe from "stripe";
import { env } from "@/lib/env";

/**
 * The credit pack sold in (test-mode) checkout: 5 AI credits for $5. `amount` is in the smallest
 * currency unit (cents). 1 credit = 1 AI request (Ask / Act / Capture-generate / Tracks-explain).
 */
export const CREDIT_PACK = {
  credits: 5,
  amount: 500,
  currency: "usd",
  label: "5 Locus AI credits",
} as const;

/** True when Stripe keys are configured. The credit paywall only activates when this is true. */
export function stripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}

let client: Stripe | null = null;
/** Lazily construct the Stripe client. Throws a clear error if the (test) secret key isn't set. */
export function getStripe(): Stripe {
  if (client) return client;
  const key = env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  client = new Stripe(key);
  return client;
}
