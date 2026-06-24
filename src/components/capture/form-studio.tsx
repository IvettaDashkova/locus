"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";

// Client-only: pulls in maplibre-gl + terra-draw, which touch `window`.
const FormRenderer = dynamic(() => import("./form-renderer").then((m) => m.FormRenderer), {
  ssr: false,
  loading: () => <div className="h-40 animate-pulse rounded-md bg-muted" />,
});

type Generated = { jsonSchema: Record<string, unknown>; uiSchema: Record<string, unknown> };
export type SaveResult = { submissionId: string; siteId: string | null; siteName: string | null };

export function FormStudio({ onSaved }: { onSaved?: (r: SaveResult) => void }) {
  const { t } = useI18n();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [generated, setGenerated] = useState<Generated | null>(null);
  const [formData, setFormData] = useState<unknown>({});
  const [inspector, setInspector] = useState("");
  const [inspectorError, setInspectorError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const examples = [t("capture.example1"), t("capture.example2")];

  async function generate() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setSaveError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("capture.generateFailed"));
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
      if (!res.ok) setSaveError(body.error ?? t("capture.saveFailed"));
      else onSaved?.(body as SaveResult);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden md:grid-cols-2">
      {/* Left: prompt + editable schema inspector */}
      <div className="flex min-h-0 flex-col gap-3 overflow-auto border-b p-4 md:border-r md:border-b-0">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder={t("capture.promptPlaceholder")}
          className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        <div className="flex flex-wrap gap-1.5">
          {examples.map((ex, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPrompt(ex)}
              className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {t("capture.example", { n: i + 1 })}
            </button>
          ))}
        </div>
        <Button onClick={generate} disabled={loading || !prompt.trim()}>
          {loading ? t("capture.generating") : t("capture.generate")}
        </Button>
        {error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {generated ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{t("capture.schemaEditable")}</span>
              {inspectorError ? <span className="text-xs text-destructive">{t("capture.invalidJson")}</span> : null}
            </div>
            <textarea
              value={inspector}
              onChange={(e) => onInspectorChange(e.target.value)}
              spellCheck={false}
              className="min-h-48 w-full flex-1 resize-none rounded-md border bg-muted/30 p-3 font-mono text-xs outline-none focus-visible:border-ring"
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
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            {generated ? t("capture.fixJson") : t("capture.previewEmpty")}
          </div>
        )}
      </div>
    </div>
  );
}
