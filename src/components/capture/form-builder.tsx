"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

type GenerateResult = { jsonSchema: Record<string, unknown>; uiSchema: Record<string, unknown> };

const EXAMPLES = [
  "A field survey form: site name, condition rating (poor/fair/good), inspector notes, and the location on a map.",
  "A delivery stop: address, recipient, package count, fragile (yes/no), and a delivery point.",
];

export function FormBuilder() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);

  async function generate() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Generation failed.");
        setResult(null);
      } else {
        setResult(data as GenerateResult);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="flex h-full w-[440px] max-w-[92vw] flex-col gap-0 overflow-hidden bg-card/95 py-0 shadow-lg backdrop-blur">
      <CardHeader className="gap-1 border-b py-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Capture</CardTitle>
          <Badge variant="secondary">Phase 1</Badge>
        </div>
        <CardDescription>Describe a form in plain English — the schema is generated for you.</CardDescription>
      </CardHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="e.g. A field survey form with a site name, condition rating, photo notes, and a location."
          className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />

        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPrompt(ex)}
              className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Example {i + 1}
            </button>
          ))}
        </div>

        <Button onClick={generate} disabled={loading || !prompt.trim()}>
          {loading ? "Generating…" : "Generate form"}
        </Button>

        {error && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {result && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-1 text-xs font-medium text-muted-foreground">Generated JSON Schema</div>
            <ScrollArea className="min-h-0 flex-1 rounded-md border bg-muted/30">
              <pre className="p-3 text-xs leading-relaxed">{JSON.stringify(result.jsonSchema, null, 2)}</pre>
            </ScrollArea>
            <p className="mt-2 text-xs text-muted-foreground">
              Next step: render this with RJSF and the map location widgets, then save submissions.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
