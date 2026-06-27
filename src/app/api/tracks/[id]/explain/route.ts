import { streamText } from "ai";
import { getModel } from "@/lib/ai/provider";
import { getTrack } from "@/lib/tracks/queries";
import { EXPLAIN_SYSTEM, tripFacts } from "@/lib/tracks/explain";
import { recordAiUsage, markExhausted, isQuotaError } from "@/lib/ai/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST → stream a plain-language briefing for a track. The COMPUTED metrics are injected as grounded
 * facts; the model is forbidden from doing any arithmetic of its own (it narrates, it doesn't count).
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getTrack(id);
  if (!detail || !detail.track.metrics) {
    return new Response("Track not found or has no metrics.", { status: 404 });
  }

  const facts = tripFacts(detail.track, detail.track.metrics, detail.segments);
  const result = streamText({
    model: getModel(),
    system: EXPLAIN_SYSTEM,
    prompt: `Write the briefing for this trip.\n\nFacts:\n${facts}`,
    onFinish: ({ steps }) => void recordAiUsage(steps?.length ?? 1),
    onError: ({ error }) => {
      if (isQuotaError(String(error))) void markExhausted();
    },
  });
  return result.toTextStreamResponse();
}
