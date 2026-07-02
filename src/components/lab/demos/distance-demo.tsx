"use client";

import { useMemo, useState } from "react";
import { Ruler } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import { worldToXY } from "@/lib/lab/projection";
import { naivePlanarM, planarErrorFraction, haversineM } from "@/lib/lab/distance";
import type { LngLat } from "@/lib/lab/types";
import { DemoCard, Insight, Metric, LAB_COLORS } from "../demo-card";
import { MiniMap, type MiniFeature } from "../mini-map";

const W = 760;
const H = 380;

export function DistanceDemo({ index }: { index: number }) {
  const { t } = useI18n();
  const [lat, setLat] = useState(60);
  const sep = 8; // degrees of longitude between the two points

  const a: LngLat = useMemo(() => [-sep / 2, lat], [lat]);
  const b: LngLat = useMemo(() => [sep / 2, lat], [lat]);

  const naiveKm = naivePlanarM(a, b) / 1000;
  const realKm = haversineM(a, b) / 1000;
  const err = planarErrorFraction(a, b) * 100;

  const features: MiniFeature[] = [
    { kind: "line", coords: [a, b], color: LAB_COLORS.problem, width: 3, dash: "6 4" },
    { kind: "pin", coord: a, color: LAB_COLORS.neutral },
    { kind: "pin", coord: b, color: LAB_COLORS.neutral },
  ];

  return (
    <DemoCard index={index} icon={<Ruler className="size-5" />} title={t("lab.dist.title")} blurb={t("lab.dist.blurb")}>
      <label className="flex items-center gap-3 text-xs text-muted-foreground">
        {t("lab.dist.latitude")}: <span className="font-semibold tabular-nums text-foreground">{lat}°</span>
        <input
          type="range"
          min={0}
          max={80}
          step={1}
          value={lat}
          onChange={(e) => setLat(Number(e.target.value))}
          className="flex-1 cursor-pointer accent-primary"
        />
      </label>

      <MiniMap
        project={(p) => worldToXY(p, W, H)}
        features={features}
        width={W}
        height={H}
        graticuleStep={30}
        className="w-full rounded-lg border"
      />

      <div className="grid grid-cols-3 gap-2">
        <Metric label={t("lab.dist.naive")} value={`${naiveKm.toFixed(0)} km`} hint={t("lab.dist.naiveHint")} />
        <Metric label={t("lab.dist.haversine")} value={`${realKm.toFixed(0)} km`} hint={t("lab.dist.haversineHint")} />
        <Metric label={t("lab.dist.error")} value={`+${err.toFixed(0)}%`} hint={t("lab.dist.errorHint")} />
      </div>

      {err > 5 ? (
        <Insight tone="problem">{t("lab.dist.problem")}</Insight>
      ) : (
        <Insight tone="solution">{t("lab.dist.fix")}</Insight>
      )}
    </DemoCard>
  );
}
