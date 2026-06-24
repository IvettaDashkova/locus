"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/provider";

type Module = "capture" | "ask" | "act" | "tracks";

/** Phase-0 placeholder card shown over the map for a not-yet-built module. */
export function ModulePlaceholder({ module, phase }: { module: Module; phase: string }) {
  const { t } = useI18n();
  return (
    <Card className="pointer-events-auto m-4 max-w-md bg-card/95 shadow-lg backdrop-blur">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{t(`nav.${module}`)}</CardTitle>
          <Badge variant="secondary">{phase}</Badge>
        </div>
        <CardDescription>{t(`${module}.blurb`)}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{t("module.comingSoon")}</CardContent>
    </Card>
  );
}
