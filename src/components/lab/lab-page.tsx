"use client";

import { FlaskConical } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import { GpsJitterDemo } from "./demos/gps-jitter-demo";
import { LatLngSwapDemo } from "./demos/latlng-swap-demo";
import { AntimeridianDemo } from "./demos/antimeridian-demo";
import { DistanceDemo } from "./demos/distance-demo";
import { SimplifyDemo } from "./demos/simplify-demo";
import { ViewportUrlDemo } from "./demos/viewport-url-demo";
import { ClusteringDemo } from "./demos/clustering-demo";

/**
 * The navigation-lab: a scrollable page of self-contained demos, each pairing a common map/navigation
 * bug with its fix. It overlays the shared module map (pointer-events-auto + solid background), so it
 * fits the app shell without needing that map — every visual is its own offline SVG.
 */
export function LabPage() {
  const { t } = useI18n();
  return (
    <div className="pointer-events-auto absolute inset-0 z-20 overflow-y-auto bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <header className="mb-6 flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FlaskConical className="size-6" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-semibold">{t("lab.title")}</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("lab.subtitle")}</p>
          </div>
        </header>

        <div className="flex flex-col gap-5">
          <GpsJitterDemo index={1} />
          <LatLngSwapDemo index={2} />
          <AntimeridianDemo index={3} />
          <DistanceDemo index={4} />
          <SimplifyDemo index={5} />
          <ClusteringDemo index={6} />
          <ViewportUrlDemo index={7} />
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">{t("lab.footer")}</p>
      </div>
    </div>
  );
}
