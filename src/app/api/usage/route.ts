import { NextResponse } from "next/server";
import { getAiUsage } from "@/lib/ai/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET → today's Gemini free-tier usage { limit, used, remaining, day, resetsAt }. */
export async function GET() {
  const usage = await getAiUsage();
  return NextResponse.json(usage, { headers: { "cache-control": "no-store" } });
}
