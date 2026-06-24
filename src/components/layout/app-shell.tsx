"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";
import { ModuleNav } from "./module-nav";
import { LanguageSwitcher } from "./language-switcher";
import { useI18n } from "@/lib/i18n/provider";

/** Top bar + left module nav + main content region (where the map lives). */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-card/60 px-4 backdrop-blur">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <MapPin className="size-5 text-primary" />
          Locus
        </Link>
        <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">{t("app.subtitle")}</span>
        <div className="ml-auto">
          <LanguageSwitcher />
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-56 shrink-0 border-r bg-card/40 sm:block">
          <ModuleNav />
        </aside>
        <main className="relative min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
