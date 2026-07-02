"use client";

import { useMemo, useState } from "react";
import { Waypoints } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import { noisyWalk } from "@/lib/lab/fixtures";
import { movingAverage, ema, kalmanSmooth, pathLengthM } from "@/lib/lab/smooth";
import { fitProjection } from "@/lib/lab/projection";
import type { LngLat } from "@/lib/lab/types";
import { DemoCard, Insight, Impact, Metric, Segmented, LAB_COLORS } from "../demo-card";
import { MiniMap, type MiniFeature } from "../mini-map";

type Mode = "raw" | "avg" | "ema" | "kalman";

export function GpsJitterDemo({ index }: { index: number }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>("raw");
  const [noise, setNoise] = useState(0.00018);

  const { truth, noisy } = useMemo(() => noisyWalk(140, noise), [noise]);
  const processed = useMemo<LngLat[]>(() => {
    switch (mode) {
      case "avg":
        return movingAverage(noisy, 9);
      case "ema":
        return ema(noisy, 0.25);
      case "kalman":
        return kalmanSmooth(noisy, 2e-6, 6e-4);
      default:
        return noisy;
    }
  }, [mode, noisy]);

  const project = useMemo(() => fitProjection([...truth, ...noisy], 760, 360), [truth, noisy]);
  const isRaw = mode === "raw";

  const truthLen = pathLengthM(truth);
  const shownLen = pathLengthM(processed);
  const inflation = ((shownLen - truthLen) / truthLen) * 100;

  const features: MiniFeature[] = [
    { kind: "line", coords: truth, color: LAB_COLORS.truth, width: 2, dash: "5 5", opacity: 0.7 },
    { kind: "dots", coords: noisy, color: LAB_COLORS.problem, radius: 1.5, opacity: isRaw ? 0.55 : 0.28 },
    {
      kind: "line",
      coords: processed,
      color: isRaw ? LAB_COLORS.problem : LAB_COLORS.solution,
      width: 3,
    },
  ];

  return (
    <DemoCard index={index} icon={<Waypoints className="size-5" />} title={t("lab.jitter.title")} blurb={t("lab.jitter.blurb")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<Mode>
          ariaLabel={t("lab.jitter.title")}
          value={mode}
          onChange={setMode}
          options={[
            { value: "raw", label: t("lab.jitter.raw"), tone: "problem" },
            { value: "avg", label: t("lab.jitter.avg"), tone: "solution" },
            { value: "ema", label: t("lab.jitter.ema"), tone: "solution" },
            { value: "kalman", label: t("lab.jitter.kalman"), tone: "solution" },
          ]}
        />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          {t("lab.jitter.noise")}
          <input
            type="range"
            min={0.00004}
            max={0.0004}
            step={0.00002}
            value={noise}
            onChange={(e) => setNoise(Number(e.target.value))}
            className="w-28 cursor-pointer accent-primary"
          />
        </label>
      </div>

      <MiniMap project={project} features={features} graticuleStep={0} className="w-full rounded-lg border" />

      <div className="grid grid-cols-3 gap-2">
        <Metric label={t("lab.jitter.trueLen")} value={`${(truthLen / 1000).toFixed(2)} km`} />
        <Metric label={t("lab.jitter.measLen")} value={`${(shownLen / 1000).toFixed(2)} km`} />
        <Metric
          label={t("lab.jitter.inflation")}
          value={`${inflation > 0 ? "+" : ""}${inflation.toFixed(0)}%`}
          hint={isRaw ? t("lab.jitter.inflationBad") : t("lab.jitter.inflationGood")}
        />
      </div>

      {isRaw ? (
        <Insight tone="problem">{t("lab.jitter.problem")}</Insight>
      ) : (
        <Insight tone="solution">{t("lab.jitter.fix")}</Insight>
      )}
      <Impact>{t("lab.jitter.impact")}</Impact>
    </DemoCard>
  );
}
