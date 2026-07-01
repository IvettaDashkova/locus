/**
 * OpenTelemetry → Langfuse tracing. Next.js calls `register()` once per runtime at boot.
 * Tracing is opt-in: it only wires up when LANGFUSE keys are present, so the app runs fine
 * without them. The AI SDK emits spans when `experimental_telemetry.isEnabled` (see lib/act/agent).
 */
// Held so request handlers can force-flush after a streamed response closes. On serverless the
// instance can freeze the moment the stream ends, before the batch processor exports — losing the
// exact Ask/Act traces we care about. Routes call `flushTracing()` in an `after()` callback.
let processor: { forceFlush: () => Promise<void> } | null = null;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.LANGFUSE_PUBLIC_KEY) return;

  const { registerOTel } = await import("@vercel/otel");
  const { LangfuseSpanProcessor } = await import("@langfuse/otel");
  const span = new LangfuseSpanProcessor();
  processor = span;
  registerOTel({
    serviceName: "locus",
    spanProcessors: [span],
  });
}

/** Flush buffered spans to Langfuse. No-op when tracing isn't configured. */
export async function flushTracing(): Promise<void> {
  try {
    await processor?.forceFlush();
  } catch {
    /* ignore — tracing must never break a request */
  }
}
