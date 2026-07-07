import * as Sentry from "@sentry/nextjs";

/**
 * Client-side Sentry — error capture only. Opt-in: it initializes only when NEXT_PUBLIC_SENTRY_DSN
 * is set, so the app runs untouched without it. Performance tracing is off (tracesSampleRate 0) — the
 * app's request tracing goes to Langfuse (OpenTelemetry, see instrumentation.ts); Sentry is just the
 * error reporter.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    // Session Replay / heavy features stay off to keep the client bundle lean.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}

// Lets Sentry tie client errors to the App Router navigation that caused them (no-op if uninitialized).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
