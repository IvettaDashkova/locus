"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";
import { useAuth } from "@/components/auth/auth-context";
import { SignInHint } from "@/components/auth/sign-in-hint";

/** "Explain this trip" — streams a grounded AI briefing built from the track's computed metrics. */
export function TrackExplain({ trackId }: { trackId: string }) {
  const { t } = useI18n();
  const { isLoggedIn } = useAuth();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function explain() {
    if (busy) return;
    // The briefing spends the shared AI budget (sign-in-gated). The rest of Tracks — metrics, charts,
    // playback, heatmap — stays fully usable signed-out, so this is the only login-gated bit here.
    if (!isLoggedIn) {
      setText(t("auth.aiRequiresLogin"));
      return;
    }
    setBusy(true);
    setText("");
    try {
      const res = await fetch(`/api/tracks/${trackId}/explain`, { method: "POST" });
      if (res.status === 401) {
        setText(t("auth.aiRequiresLogin"));
        return;
      }
      if (res.status === 402) {
        setText(t("credits.needCredits"));
        return;
      }
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
      {!isLoggedIn ? <SignInHint callbackUrl="/tracks" /> : null}
    </div>
  );
}
