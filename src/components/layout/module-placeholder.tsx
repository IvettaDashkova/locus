"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/provider";

type Module = "capture" | "ask" | "act" | "tracks";

/** "In development" card shown over the map: what the module will do + the skills it showcases. */
export function ModulePlaceholder({ module }: { module: Module }) {
  const { t } = useI18n();
  const tech = t(`${module}.tech`)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <Card className="pointer-events-auto m-4 max-w-md bg-card/95 shadow-xl backdrop-blur">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-xl">{t(`nav.${module}`)}</CardTitle>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
            </span>
            {t("status.inDevelopment")}
          </span>
        </div>
        <CardDescription className="pt-1 leading-relaxed">{t(`${module}.blurb`)}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("module.intro")}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {tech.map((item) => (
            <span
              key={item}
              className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-accent-foreground"
            >
              {item}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
