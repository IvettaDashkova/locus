import { generateText, tool } from "ai";
import { getModel } from "@/lib/ai/provider";
import {
  emitInput,
  buildSchema,
  type GeneratedSchema,
  type UiSchema,
  GEO_POINT_FORMAT,
  GEO_POLYGON_FORMAT,
} from "./schema-spec";

/**
 * Core form-schema generation, shared by the /api/generate route and the Capture evals. The LLM
 * emits an array of fields via the emit_schema tool; we Zod-guard and retry once with the error fed
 * back, then build the JSON Schema + uiSchema. The LLM only structures — it never invents data.
 */

const SYSTEM = [
  "You design data-entry forms as JSON Schema (a flat subset of draft 2020-12).",
  "You STRUCTURE the form from the user's description — you never invent example data or values.",
  "Rules:",
  "- root is an object; one property per field, with a human title and (when useful) description;",
  `- for a single location/coordinate field use "format":"${GEO_POINT_FORMAT}"; for an area/boundary use "format":"${GEO_POLYGON_FORMAT}";`,
  '- use "enum" for fixed choices; "format":"date"/"email"/"uri" where appropriate;',
  "- list which fields are required;",
  '- for conditional fields ("if X then ask Y") use a "conditionals" array of { whenField, equals, requireFields };',
  "- keep fields flat (no nested objects); simple arrays of scalars are fine.",
  "Always respond by calling the emit_schema tool.",
].join("\n");

function buildPrompt(description: string, previousError?: string): string {
  const base = `Design a form for this description:\n"""${description}"""`;
  if (!previousError) return base;
  return `${base}\n\nYour previous attempt failed validation:\n${previousError}\nFix it and call emit_schema again.`;
}

export type GenerateResult =
  | { ok: true; jsonSchema: GeneratedSchema; uiSchema: UiSchema }
  | { ok: false; error: string };

async function attempt(description: string, previousError?: string): Promise<GenerateResult> {
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

    const parsed = emitInput.safeParse(call.input);
    if (!parsed.success) return { ok: false, error: JSON.stringify(parsed.error.issues) };

    const { jsonSchema, uiSchema } = buildSchema(parsed.data);
    return { ok: true, jsonSchema, uiSchema };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Generate a form schema from a description, retrying once with the validation error fed back. */
export async function generateForm(description: string): Promise<GenerateResult> {
  let res = await attempt(description);
  if (!res.ok) res = await attempt(description, res.error);
  return res;
}
