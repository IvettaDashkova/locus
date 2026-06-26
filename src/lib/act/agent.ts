import { streamText, stepCountIs } from "ai";
import { getModel } from "@/lib/ai/provider";
import { aiTools } from "./tools";

/** System prompt for the Act agent — shared by the API route and the evals. */
export const ACT_SYSTEM = [
  "You are Locus Act, a geospatial agent. Complete the user's location task using the provided tools.",
  "- ALWAYS geocode place names to coordinates BEFORE calling route, isochrone, weather, elevation, or sun_times.",
  "- Coordinates are [lng, lat]. Never invent coordinates, distances, durations, or numbers — get them from tools.",
  "- Plan → call tools → observe results → iterate until the task is done, then give a concise answer.",
  "- Answer in the user's language.",
].join("\n");

/** Langfuse tracing is opt-in: enabled only when keys are present (see src/instrumentation.ts). */
const tracingEnabled = () => Boolean(process.env.LANGFUSE_PUBLIC_KEY);

/**
 * Start an Act agent run. Returns the live streamText result (the route streams its `fullStream`)
 * plus the `features` array the tools collect into as they execute.
 */
export function runAct(task: string) {
  const features: GeoJSON.Feature[] = [];
  const tools = aiTools((fs) => features.push(...fs));
  const result = streamText({
    model: getModel(),
    system: ACT_SYSTEM,
    prompt: task,
    tools,
    stopWhen: stepCountIs(8),
    experimental_telemetry: {
      isEnabled: tracingEnabled(),
      functionId: "act-agent",
      metadata: { task },
    },
  });
  return { result, features };
}

export type ActOutcome = {
  text: string;
  toolCalls: { name: string; input: unknown }[];
  steps: number;
  features: GeoJSON.Feature[];
};

/** Run an Act task to completion and aggregate the outcome — used by the evals. */
export async function collectAct(task: string): Promise<ActOutcome> {
  const { result, features } = runAct(task);
  const toolCalls: { name: string; input: unknown }[] = [];
  for await (const part of result.fullStream) {
    if (part.type === "tool-call") toolCalls.push({ name: part.toolName, input: part.input });
    else if (part.type === "error") throw new Error(String(part.error));
  }
  const text = await result.text;
  const steps = (await result.steps).length;
  return { text, toolCalls, steps, features };
}
