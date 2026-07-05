"use client";

import { Coins, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-context";
import { useCredits } from "./credits-context";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Header credit pill + buy button. Only shown to signed-in users when the paywall is active; the
 * balance decrements live as AI requests are made, and turns red at zero to nudge a top-up.
 */
export function CreditsBadge() {
  const { t } = useI18n();
  const { isLoggedIn } = useAuth();
  const { balance, enabled, startCheckout, checkoutBusy } = useCredits();

  // Hidden until the paywall is on and we know the signed-in balance.
  if (!isLoggedIn || !enabled || balance === null) return null;

  const empty = balance <= 0;

  return (
    <div className="flex items-center gap-1">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums ${
          empty
            ? "border-destructive/40 bg-destructive/10 text-destructive"
            : "border-border bg-muted/50 text-muted-foreground"
        }`}
        title={t("credits.tooltip", { n: String(balance) })}
      >
        <Coins className="size-3.5" aria-hidden />
        <span className="hidden sm:inline">{t("credits.label")}</span>
        {balance}
      </span>
      <Button
        variant={empty ? "default" : "ghost"}
        size="sm"
        className="h-7 gap-1 px-2 text-xs"
        onClick={() => startCheckout()}
        disabled={checkoutBusy}
        title={t("credits.buy")}
      >
        {checkoutBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
        <span className="hidden sm:inline">{t("credits.buy")}</span>
      </Button>
    </div>
  );
}
