import { NextResponse } from "next/server";
import { generateText, tool } from "ai";
import { getModel } from "@/lib/ai/provider";
import {
  emitInput,
  buildSchema,
  type GeneratedSchema,
  type UiSchema,
  GEO_POINT_FORMAT,
  GEO_POLYGON_FORMAT,
} from "@/lib/capture/schema-spec";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM = [
  "You design data-entry forms as JSON Schema (a flat subset of draft 2020-12).",
  "You STRUCTURE the form from the user's description — you never invent example data or values.",
  "Rules:",
  "- root is an object; one property per field, with a human title and (when useful) description;",
  `- for a single location/coordinate field use "format":"${GEO_POINT_FORMAT}"; for an area/boundary use "format":"${GEO_POLYGON_FORMAT}";`,
  '- use "enum" for fixed choices; "format":"date"/"email"/"uri" where appropriate;',
  "- list which fields are required;",
  '- for conditional fields ("if X then ask Y") use an "allOf" array of { if, then } blocks;',
  "- keep fields flat (no nested objects); simple arrays of scalars are fine.",
  "Always respond by calling the emit_schema tool with the schema.",
].join("\n");

function buildPrompt(description: string, previousError?: string): string {
  const base = `Design a form for this description:\n"""${description}"""`;
  if (!previousError) return base;
  return `${base}\n\nYour previous attempt failed validation:\n${previousError}\nFix it and call emit_schema again.`;
}

type Attempt =
  | { ok: true; jsonSchema: GeneratedSchema; uiSchema: UiSchema }
  | { ok: false; error: string };

async function attempt(description: string, previousError?: string): Promise<Attempt> {
  try {
    const result = await generateText({
      model: getModel(),
      system: SYSTEM,
      prompt: buildPrompt(description, previousError),
      tools: {
        emit_schema: tool({
          description: "Emit the form's title and an array of fields.",
          inputSchema: emitInput,
        }),
      },
      toolChoice: "required",
    });

    const call = result.toolCalls.find((c) => c.toolName === "emit_schema");
    if (!call) return { ok: false, error: "Model did not call emit_schema." };

    // SDK validates tool input against emitInput; re-parse to be certain, then build the schema.
    const parsed = emitInput.safeParse(call.input);
    if (!parsed.success) {
      return { ok: false, error: JSON.stringify(parsed.error.issues) };
    }
    const { jsonSchema, uiSchema } = buildSchema(parsed.data);
    return { ok: true, jsonSchema, uiSchema };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** POST { prompt } → { jsonSchema, uiSchema }. The LLM emits a schema; we Zod-guard, retry once. */
export async function POST(req: Request) {
  let body: { prompt?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json({ error: "A 'prompt' string is required." }, { status: 400 });
  }

  let res = await attempt(prompt);
  if (!res.ok) res = await attempt(prompt, res.error); // retry once with the error fed back
  if (!res.ok) {
    return NextResponse.json({ error: `Could not generate a valid schema: ${res.error}` }, { status: 422 });
  }

  return NextResponse.json({ jsonSchema: res.jsonSchema, uiSchema: res.uiSchema });
}
