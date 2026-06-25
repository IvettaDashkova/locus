import { streamText, stepCountIs } from "ai";
import { getModel } from "@/lib/ai/provider";
import { aiTools } from "@/lib/act/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM = [
  "You are Locus Act, a geospatial agent. Complete the user's location task using the provided tools.",
  "- ALWAYS geocode place names to coordinates BEFORE calling route, isochrone, weather, elevation, or sun_times.",
  "- Coordinates are [lng, lat]. Never invent coordinates, distances, durations, or numbers — get them from tools.",
  "- Plan → call tools → observe results → iterate until the task is done, then give a concise answer.",
  "- Answer in the user's language.",
].join("\n");

export async function POST(req: Request) {
  let body: { task?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body.", { status: 400 });
  }
  const task = typeof body.task === "string" ? body.task.trim() : "";
  if (!task) return new Response("A 'task' is required.", { status: 400 });

  const features: GeoJSON.Feature[] = [];
  const tools = aiTools((fs) => features.push(...fs));

  const result = streamText({
    model: getModel(),
    system: SYSTEM,
    prompt: task,
    tools,
    stopWhen: stepCountIs(8),
  });

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
            send({ type: "error", error: String(part.error) });
          }
        }
        flushFeatures();
        send({ type: "done" });
      } catch (e) {
        send({ type: "error", error: e instanceof Error ? e.message : String(e) });
      }
      controller.close();
    },
  });

  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8" } });
}
