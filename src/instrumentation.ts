/**
 * OpenTelemetry → Langfuse tracing. Next.js calls `register()` once per runtime at boot.
 * Tracing is opt-in: it only wires up when LANGFUSE keys are present, so the app runs fine
 * without them. The AI SDK emits spans when `experimental_telemetry.isEnabled` (see lib/act/agent).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.LANGFUSE_PUBLIC_KEY) return;

  const { registerOTel } = await import("@vercel/otel");
  const { LangfuseSpanProcessor } = await import("@langfuse/otel");
  registerOTel({
    serviceName: "locus",
    spanProcessors: [new LangfuseSpanProcessor()],
  });
}
