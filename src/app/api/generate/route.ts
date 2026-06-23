import { NextResponse } from "next/server";
import { generateForm } from "@/lib/capture/generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const res = await generateForm(prompt);
  if (!res.ok) {
    return NextResponse.json({ error: `Could not generate a valid schema: ${res.error}` }, { status: 422 });
  }
  return NextResponse.json({ jsonSchema: res.jsonSchema, uiSchema: res.uiSchema });
}
