"use client";

import { useActionState } from "react";
import { MapPin, LogIn, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";
import { signInWithPassword, signInWithProvider } from "./actions";

/** The sign-in card. `oauth` lists which OAuth providers are configured (server-decided). */
export function LoginForm({
  oauth,
  showDemoHint,
}: {
  oauth: ("github" | "google")[];
  showDemoHint: boolean;
}) {
  const { t } = useI18n();
  const [error, action, pending] = useActionState(signInWithPassword, null);

  return (
    <div className="w-full max-w-sm rounded-2xl border bg-card/95 p-6 shadow-xl backdrop-blur">
      <div className="mb-5 flex flex-col items-center gap-2 text-center">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10">
          <MapPin className="size-6 text-primary" />
        </div>
        <h1 className="text-lg font-semibold">{t("auth.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("auth.subtitle")}</p>
      </div>

      <form action={action} className="space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-xs font-medium text-muted-foreground">
            {t("auth.password")}
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              autoFocus
              required
              className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
        </div>
        {error === "invalid" ? <p className="text-sm text-destructive">⚠ {t("auth.invalid")}</p> : null}
        <Button type="submit" disabled={pending} className="w-full gap-2">
          <LogIn className="size-4" />
          {pending ? t("auth.signing") : t("auth.signin")}
        </Button>
        {showDemoHint ? (
          <p className="text-center text-xs text-muted-foreground">{t("auth.demoHint")}</p>
        ) : null}
      </form>

      {oauth.length ? (
        <>
          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {t("auth.or")}
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="space-y-2">
            {oauth.map((p) => (
              <form key={p} action={signInWithProvider}>
                <input type="hidden" name="provider" value={p} />
                <Button type="submit" variant="outline" className="w-full gap-2">
                  <LogIn className="size-4" />
                  {t(p === "github" ? "auth.github" : "auth.google")}
                </Button>
              </form>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
