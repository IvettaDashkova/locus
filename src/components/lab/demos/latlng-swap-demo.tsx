"use client";

import { useState } from "react";
import { Shuffle } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import { worldToXY } from "@/lib/lab/projection";
import { haversineM } from "@/lib/lab/distance";
import { CITIES } from "@/lib/lab/fixtures";
import type { LngLat } from "@/lib/lab/types";
import { DemoCard, Insight, Impact, Metric, Segmented, LAB_COLORS } from "../demo-card";
import { MiniMap, type MiniFeature } from "../mini-map";

const W = 760;
const H = 380;
const correct = CITIES.kyiv; // [30.52, 50.45]
const swapped: LngLat = [correct[1], correct[0]]; // [50.45, 30.52] — lat & lng flipped

export function LatLngSwapDemo({ index }: { index: number }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"buggy" | "fixed">("buggy");
  const buggy = mode === "buggy";
  const offBy = haversineM(correct, swapped) / 1000;

  const shown = buggy ? swapped : correct;
  const features: MiniFeature[] = [
    { kind: "dots", coords: [correct], color: LAB_COLORS.solution, radius: 0, opacity: 0 }, // keep bounds stable
    {
      kind: "pin",
      coord: shown,
      color: buggy ? LAB_COLORS.problem : LAB_COLORS.solution,
      label: buggy ? t("lab.swap.pinWrong") : "Kyiv",
      sub: `${shown[1].toFixed(2)}, ${shown[0].toFixed(2)}`,
    },
  ];

  return (
    <DemoCard index={index} icon={<Shuffle className="size-5" />} title={t("lab.swap.title")} blurb={t("lab.swap.blurb")}>
      <Segmented
        ariaLabel={t("lab.swap.title")}
        value={mode}
        onChange={setMode}
        options={[
          { value: "buggy", label: t("lab.swap.buggy"), tone: "problem" },
          { value: "fixed", label: t("lab.swap.fixed"), tone: "solution" },
        ]}
      />

      <MiniMap
        project={(p) => worldToXY(p, W, H)}
        features={features}
        width={W}
        height={H}
        graticuleStep={30}
        className="w-full rounded-lg border"
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Metric label={t("lab.swap.stored")} value="[lat, lng]" hint={t("lab.swap.storedHint")} />
        <Metric label={t("lab.swap.expected")} value="[lng, lat]" hint={t("lab.swap.expectedHint")} />
        <Metric label={t("lab.swap.offBy")} value={`${offBy.toFixed(0)} km`} hint={t("lab.swap.offByHint")} />
      </div>

      {buggy ? (
        <Insight tone="problem">{t("lab.swap.problem")}</Insight>
      ) : (
        <Insight tone="solution">{t("lab.swap.fix")}</Insight>
      )}
      <Impact>{t("lab.swap.impact")}</Impact>
    </DemoCard>
  );
}
