"use client";

import Link from "next/link";
import { LogIn } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";

/** Inline notice shown where a logged-out user tries to save. Links to /login and back. */
export function SignInHint({ callbackUrl }: { callbackUrl?: string }) {
  const { t } = useI18n();
  const href = callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/login";
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{t("auth.saveRequiresLogin")}</span>
      <Link
        href={href}
        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
      >
        <LogIn className="size-3.5" />
        {t("auth.signin")}
      </Link>
    </div>
  );
}
