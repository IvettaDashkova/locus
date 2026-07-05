import { NextResponse } from "next/server";
import { getBalance } from "@/lib/ai/credits";
import { stripeConfigured } from "@/lib/stripe";
import { requireUser } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET → the signed-in user's AI credit balance (for the header pill). `enabled` reflects the paywall. */
export async function GET() {
  const who = await requireUser();
  if (who instanceof NextResponse) return who;
  return NextResponse.json({ balance: await getBalance(who.id), enabled: stripeConfigured() });
}
