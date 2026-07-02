"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import { worldToXY } from "@/lib/lab/projection";
import { splitAntimeridian } from "@/lib/lab/antimeridian";
import { haversineM } from "@/lib/lab/distance";
import { CITIES } from "@/lib/lab/fixtures";
import { DemoCard, Insight, Metric, Segmented, LAB_COLORS } from "../demo-card";
import { MiniMap, type MiniFeature } from "../mini-map";

const W = 760;
const H = 380;
const tokyo = CITIES.tokyo;
const sf = CITIES.sanFrancisco;

export function AntimeridianDemo({ index }: { index: number }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"naive" | "split">("naive");
  const naive = mode === "naive";

  const realKm = haversineM(tokyo, sf) / 1000; // short, great-circle across the Pacific
  const drawnKm = naive ? 360 - Math.abs(tokyo[0] - sf[0]) : Math.abs(tokyo[0] - sf[0]);
  // ^ purely illustrative "degrees of longitude the drawn line spans", to contrast the two.

  const pins: MiniFeature[] = [
    { kind: "pin", coord: tokyo, color: LAB_COLORS.truth, label: "Tokyo" },
    { kind: "pin", coord: sf, color: LAB_COLORS.truth, label: "San Francisco" },
  ];

  const lines: MiniFeature[] = naive
    ? [{ kind: "line", coords: [tokyo, sf], color: LAB_COLORS.problem, width: 3 }]
    : splitAntimeridian([tokyo, sf]).map((run) => ({
        kind: "line" as const,
        coords: run,
        color: LAB_COLORS.solution,
        width: 3,
      }));

  return (
    <DemoCard index={index} icon={<Globe className="size-5" />} title={t("lab.anti.title")} blurb={t("lab.anti.blurb")}>
      <Segmented
        ariaLabel={t("lab.anti.title")}
        value={mode}
        onChange={setMode}
        options={[
          { value: "naive", label: t("lab.anti.naive"), tone: "problem" },
          { value: "split", label: t("lab.anti.split"), tone: "solution" },
        ]}
      />

      <MiniMap
        project={(p) => worldToXY(p, W, H)}
        features={[...lines, ...pins]}
        width={W}
        height={H}
        graticuleStep={30}
        className="w-full rounded-lg border"
      />

      <div className="grid grid-cols-2 gap-2">
        <Metric label={t("lab.anti.real")} value={`${realKm.toFixed(0)} km`} hint={t("lab.anti.realHint")} />
        <Metric
          label={t("lab.anti.drawn")}
          value={`~${drawnKm.toFixed(0)}° lng`}
          hint={naive ? t("lab.anti.drawnBad") : t("lab.anti.drawnGood")}
        />
      </div>

      {naive ? (
        <Insight tone="problem">{t("lab.anti.problem")}</Insight>
      ) : (
        <Insight tone="solution">{t("lab.anti.fix")}</Insight>
      )}
    </DemoCard>
  );
}
