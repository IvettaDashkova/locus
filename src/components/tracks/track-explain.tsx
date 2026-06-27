"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";

/** "Explain this trip" — streams a grounded AI briefing built from the track's computed metrics. */
export function TrackExplain({ trackId }: { trackId: string }) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function explain() {
    if (busy) return;
    setBusy(true);
    setText("");
    try {
      const res = await fetch(`/api/tracks/${trackId}/explain`, { method: "POST" });
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          setText((cur) => cur + decoder.decode(value, { stream: true }));
        }
      }
    } catch (e) {
      setText(`⚠ ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      window.dispatchEvent(new Event("locus:ai-used")); // refresh the AI quota badge
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={explain} disabled={busy} variant="secondary" size="sm" className="gap-2">
        <Sparkles className="size-4" />
        {busy ? t("tracks.explaining") : t("tracks.explain")}
      </Button>
      {text ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
      ) : null}
    </div>
  );
}
