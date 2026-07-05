import { after, NextResponse } from "next/server";
import { runAct } from "@/lib/act/agent";
import { reserveAiBudget, recordAiUsage, markExhausted, isQuotaError } from "@/lib/ai/usage";
import { allowAiCall } from "@/lib/ai/rate-limit";
import { requireUser } from "@/lib/auth/guard";
import { flushTracing } from "@/instrumentation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  // The Act agent spends the shared daily AI budget — sign-in required. Anonymous visitors use the demo.
  const who = await requireUser();
  if (who instanceof NextResponse) return who;
  // Per-user rate limit so one account can't burst through the shared daily budget.
  if (!(await allowAiCall(who.id))) {
    return new Response("Too many AI requests — please wait a minute and try again.", { status: 429 });
  }

  let body: { task?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body.", { status: 400 });
  }
  const task = typeof body.task === "string" ? body.task.trim() : "";
  if (!task) return new Response("A 'task' is required.", { status: 400 });
  if (task.length > 2000) return new Response("That task is too long.", { status: 413 });

  // The Act agent fans out up to `stepCountIs(8)` model calls per request. Atomically reserve the
  // entry round-trip before starting — race-safe, so concurrent runs can't slip past a spent budget —
  // and reconcile the agent's actual step count once the stream drains. Open to everyone, no sign-in.
  if (!(await reserveAiBudget(1))) {
    return new Response("The daily AI budget is spent — it resets at midnight (America/Los_Angeles).", { status: 429 });
  }

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
            console.error("act stream error", part.error);
            // Don't leak raw provider/internal errors (they can echo request URLs and keys) — surface
            // a clean message, but distinguish the one cause the user can act on: a spent quota.
            if (isQuotaError(msg)) {
              void markExhausted();
              send({ type: "error", error: "The daily AI budget is spent — it resets at midnight (America/Los_Angeles)." });
            } else {
              send({ type: "error", error: "The agent hit an error and stopped." });
            }
          }
        }
        flushFeatures();
        // One generate_content call per agent step. The entry step is already reserved up front, so
        // top up only the additional steps the agent actually took.
        try {
          const steps = await result.steps;
          await recordAiUsage(steps.length - 1);
        } catch {
          /* ignore */
        }
        send({ type: "done" });
      } catch (e) {
        console.error("act stream failed", e);
        send({ type: "error", error: "The agent hit an error and stopped." });
      }
      controller.close();
    },
  });

  after(flushTracing); // export buffered Langfuse spans once the stream has drained
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8" } });
}
