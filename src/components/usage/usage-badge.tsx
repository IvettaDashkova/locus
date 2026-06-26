"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

type Usage = { limit: number; used: number; remaining: number; resetsAt: string };

/**
 * Live indicator of the Gemini free-tier daily budget (~20 generate calls/day). Refetches on mount,
 * on window focus, every 15s, and whenever an AI request fires a `locus:ai-used` event. Best-effort:
 * the server tally is an estimate (see lib/ai/usage.ts), shown so the demo's limits are transparent.
 */
export function UsageBadge() {
  const [usage, setUsage] = useState<Usage | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/usage", { cache: "no-store" });
      if (res.ok) setUsage(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(refresh, 0); // initial load, deferred out of the effect body
    const onFocus = () => refresh();
    const onUsed = () => setTimeout(refresh, 800); // let the server finish recording first
    window.addEventListener("focus", onFocus);
    window.addEventListener("locus:ai-used", onUsed);
    const id = setInterval(refresh, 15_000);
    return () => {
      clearTimeout(first);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("locus:ai-used", onUsed);
      clearInterval(id);
    };
  }, [refresh]);

  if (!usage) return null;

  const { remaining, limit, resetsAt } = usage;
  const tone =
    remaining === 0
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : remaining <= 5
        ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : "border-border bg-muted/50 text-muted-foreground";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums ${tone}`}
      title={
        remaining === 0
          ? `Gemini free-tier daily limit reached (${limit}/day). Resets at ${resetsAt}.`
          : `Gemini free tier: ${remaining} of ${limit} AI requests left today. Resets at ${resetsAt}.`
      }
    >
      <Sparkles className="size-3.5" aria-hidden />
      <span className="hidden sm:inline">AI</span>
      {remaining}/{limit}
    </span>
  );
}
