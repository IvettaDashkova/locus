import * as Sentry from "@sentry/nextjs";

/**
 * Boot-time instrumentation. Next.js calls `register()` once per runtime. Two independent, opt-in
 * observability layers:
 *   • Sentry — error monitoring, on when SENTRY_DSN is set. Errors only (tracesSampleRate 0), and
 *     `skipOpenTelemetrySetup` so it never touches the OTel provider below.
 *   • OpenTelemetry → Langfuse — request/AI tracing, on when LANGFUSE keys are present.
 * With neither env set the app runs untouched.
 */
// Held so request handlers can force-flush after a streamed response closes. On serverless the
// instance can freeze the moment the stream ends, before the batch processor exports — losing the
// exact Ask/Act traces we care about. Routes call `flushTracing()` in an `after()` callback.
let processor: { forceFlush: () => Promise<void> } | null = null;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Sentry error capture (coexists with our own OTel via skipOpenTelemetrySetup).
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0,
      skipOpenTelemetrySetup: true,
    });
  }

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

// Report uncaught server errors (route handlers, RSC) to Sentry. No-op when Sentry isn't configured.
export const onRequestError = Sentry.captureRequestError;

/** Flush buffered spans to Langfuse. No-op when tracing isn't configured. */
export async function flushTracing(): Promise<void> {
  try {
    await processor?.forceFlush();
  } catch {
    /* ignore — tracing must never break a request */
  }
}
