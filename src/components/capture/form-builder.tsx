"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Client-only: pulls in maplibre-gl + terra-draw, which touch `window` and must not run during SSR.
const FormRenderer = dynamic(() => import("./form-renderer").then((m) => m.FormRenderer), {
  ssr: false,
  loading: () => <div className="h-40 animate-pulse rounded-md bg-muted" />,
});

type Generated = { jsonSchema: Record<string, unknown>; uiSchema: Record<string, unknown> };
type SaveResult = { submissionId: string; siteId: string | null; siteName: string | null };

const EXAMPLES = [
  "A field survey form: site name, condition rating (poor/fair/good), inspector notes, and the location on a map.",
  "An incident report: type, severity, and if severity is high require an escalation contact and a boundary area on the map.",
];

export function FormBuilder() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [generated, setGenerated] = useState<Generated | null>(null);
  const [formData, setFormData] = useState<unknown>({});
  const [inspector, setInspector] = useState("");
  const [inspectorError, setInspectorError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function generate() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setSaveResult(null);
    setSaveError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Generation failed.");
        setGenerated(null);
      } else {
        setGenerated(data as Generated);
        setFormData({});
        setInspector(JSON.stringify((data as Generated).jsonSchema, null, 2));
        setInspectorError(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setGenerated(null);
    } finally {
      setLoading(false);
    }
  }

  function onInspectorChange(text: string) {
    setInspector(text);
    try {
      const parsed = JSON.parse(text);
      setInspectorError(null);
      setGenerated((g) => (g ? { ...g, jsonSchema: parsed } : g));
    } catch (e) {
      setInspectorError(e instanceof Error ? e.message : "Invalid JSON");
    }
  }

  async function save(data: unknown) {
    if (!generated) return;
    setSubmitting(true);
    setSaveError(null);
    setSaveResult(null);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: (generated.jsonSchema.title as string) ?? "Untitled form",
          jsonSchema: generated.jsonSchema,
          uiSchema: generated.uiSchema,
          data,
        }),
      });
      const body = await res.json();
      if (!res.ok) setSaveError(body.error ?? "Save failed.");
      else setSaveResult(body as SaveResult);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="flex h-full w-[940px] max-w-[94vw] flex-col gap-0 overflow-hidden bg-card/95 py-0 shadow-lg backdrop-blur">
      <CardHeader className="gap-1 border-b py-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Capture</CardTitle>
          <Badge variant="secondary">Phase 1</Badge>
        </div>
        <CardDescription>
          Describe a form in plain English — it’s generated, rendered, and saved with map location fields.
        </CardDescription>
      </CardHeader>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
        {/* Left: prompt + editable schema inspector */}
        <div className="flex min-h-0 flex-col gap-3 overflow-auto border-b p-4 md:border-r md:border-b-0">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="e.g. A field survey form with a site name, condition rating, notes, and a location."
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
          {error ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {generated ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">JSON Schema (editable)</span>
                {inspectorError ? <span className="text-xs text-destructive">invalid JSON</span> : null}
              </div>
              <textarea
                value={inspector}
                onChange={(e) => onInspectorChange(e.target.value)}
                spellCheck={false}
                className="min-h-48 flex-1 w-full resize-none rounded-md border bg-muted/30 p-3 font-mono text-xs outline-none focus-visible:border-ring"
              />
            </div>
          ) : null}
        </div>

        {/* Right: rendered form */}
        <div className="min-h-0 overflow-auto p-4">
          {generated && !inspectorError ? (
            <>
              <FormRenderer
                schema={generated.jsonSchema}
                uiSchema={generated.uiSchema}
                formData={formData}
                onChange={setFormData}
                onSubmit={save}
                submitting={submitting}
              />
              {saveError ? (
                <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {saveError}
                </p>
              ) : null}
              {saveResult ? (
                <p className="mt-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
                  Saved ✓ submission {saveResult.submissionId.slice(0, 8)}
                  {saveResult.siteName ? ` · site “${saveResult.siteName}”` : ""}
                </p>
              ) : null}
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
              {generated ? "Fix the JSON to preview the form." : "Generate a form to preview it here."}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
