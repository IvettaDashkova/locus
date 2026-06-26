import { runAct } from "@/lib/act/agent";
import { recordAiUsage, markExhausted, isQuotaError } from "@/lib/ai/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: { task?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body.", { status: 400 });
  }
  const task = typeof body.task === "string" ? body.task.trim() : "";
  if (!task) return new Response("A 'task' is required.", { status: 400 });

  const { result, features } = runAct(task);

  const encoder = new TextEncoder();
  let sent = 0;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      const flushFeatures = () => {
        if (features.length > sent) {
          send({ type: "features", features: features.slice(sent) });
          sent = features.length;
        }
      };
      try {
        for await (const part of result.fullStream) {
          if (part.type === "text-delta") send({ type: "text", delta: part.text });
          else if (part.type === "tool-call") send({ type: "tool", name: part.toolName, input: part.input });
          else if (part.type === "tool-result") {
            send({ type: "tool-result", name: part.toolName });
            flushFeatures();
          } else if (part.type === "error") {
            const msg = String(part.error);
            if (isQuotaError(msg)) void markExhausted();
            send({ type: "error", error: msg });
          }
        }
        flushFeatures();
        // One generate_content call per agent step — record the whole task's spend.
        try {
          const steps = await result.steps;
          await recordAiUsage(steps.length);
        } catch {
          /* ignore */
        }
        send({ type: "done" });
      } catch (e) {
        send({ type: "error", error: e instanceof Error ? e.message : String(e) });
      }
      controller.close();
    },
  });

  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8" } });
}
