import { streamText } from "ai";
import { getModel } from "@/lib/ai/provider";
import { getTrack } from "@/lib/tracks/queries";
import { EXPLAIN_SYSTEM, tripFacts } from "@/lib/tracks/explain";
import { reserveAiBudget, recordAiUsage, markExhausted, isQuotaError } from "@/lib/ai/usage";
import { requireAuth } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST → stream a plain-language briefing for a track. The COMPUTED metrics are injected as grounded
 * facts; the model is forbidden from doing any arithmetic of its own (it narrates, it doesn't count).
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  // The briefing spends the shared daily AI budget — sign-in required, like the other AI endpoints.
  const denied = await requireAuth();
  if (denied) return denied;

  const { id } = await params;
  const detail = await getTrack(id);
  if (!detail || !detail.track.metrics) {
    return new Response("Track not found or has no metrics.", { status: 404 });
  }

  // Atomically reserve the round-trip up front so a spent quota 429s cleanly instead of erroring mid-stream.
  if (!(await reserveAiBudget(1))) {
    return new Response("The daily AI budget is spent — it resets at midnight (America/Los_Angeles).", { status: 429 });
  }

  const facts = tripFacts(detail.track, detail.track.metrics, detail.segments);
  const result = streamText({
    model: getModel(),
    system: EXPLAIN_SYSTEM,
    prompt: `Write the briefing for this trip.\n\nFacts:\n${facts}`,
    // One round-trip is already reserved; top up only the additional steps the model actually took.
    onFinish: ({ steps }) => void recordAiUsage((steps?.length ?? 1) - 1),
    onError: ({ error }) => {
      if (isQuotaError(String(error))) void markExhausted();
    },
  });
  return result.toTextStreamResponse();
}
