"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, Menu, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ModuleNav } from "./module-nav";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { UsageBadge } from "@/components/usage/usage-badge";
import { OnboardingTour, START_TOUR_EVENT } from "@/components/onboarding/onboarding-tour";
import { useI18n } from "@/lib/i18n/provider";

/** Top bar + left module nav (collapses to a sheet on mobile) + main content region. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-1 border-b bg-card/60 px-2 backdrop-blur sm:px-4">
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetTrigger
            render={<Button variant="ghost" size="icon" className="sm:hidden" aria-label="Menu" />}
          >
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetHeader className="border-b">
              <SheetTitle className="flex items-center gap-2">
                <MapPin className="size-5 text-primary" />
                Locus
              </SheetTitle>
            </SheetHeader>
            <ModuleNav onNavigate={() => setNavOpen(false)} />
          </SheetContent>
        </Sheet>

        <Link href="/" className="flex items-center gap-2 px-1 font-semibold">
          <MapPin className="size-5 text-primary" />
          Locus
        </Link>
        <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">{t("app.subtitle")}</span>
        <div data-tour="topbar" className="ml-auto flex items-center gap-1 sm:gap-2">
          <UsageBadge />
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("onboard.help")}
            title={t("onboard.help")}
            onClick={() => window.dispatchEvent(new Event(START_TOUR_EVENT))}
          >
            <HelpCircle className="size-5" />
          </Button>
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside data-tour="modules" className="hidden w-56 shrink-0 border-r bg-card/40 sm:block">
          <ModuleNav />
        </aside>
        <main data-tour="map" className="relative min-w-0 flex-1 overflow-hidden">{children}</main>
      </div>
      <OnboardingTour />
    </div>
  );
}
