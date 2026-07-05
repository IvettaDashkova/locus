"use client";

import { useMemo, useState } from "react";
import { Spline } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import { heavyTrail } from "@/lib/lab/fixtures";
import { simplify } from "@/lib/lab/simplify";
import { fitProjection } from "@/lib/lab/projection";
import { DemoCard, Insight, Impact, Metric, LAB_COLORS } from "../demo-card";
import { MiniMap, type MiniFeature } from "../mini-map";

export function SimplifyDemo({ index }: { index: number }) {
  const { t } = useI18n();
  const [tolerance, setTolerance] = useState(40);

  const trail = useMemo(() => heavyTrail(1200), []);
  const simplified = useMemo(() => simplify(trail, tolerance), [trail, tolerance]);
  const project = useMemo(() => fitProjection(trail, 760, 360), [trail]);

  const reduction = (1 - simplified.length / trail.length) * 100;

  const features: MiniFeature[] = [
    { kind: "line", coords: trail, color: LAB_COLORS.problem, width: 4, opacity: 0.25 },
    { kind: "line", coords: simplified, color: LAB_COLORS.solution, width: 2 },
    { kind: "dots", coords: simplified, color: LAB_COLORS.solution, radius: 2 },
  ];

  return (
    <DemoCard index={index} icon={<Spline className="size-5" />} title={t("lab.simplify.title")} blurb={t("lab.simplify.blurb")}>
      <label className="flex items-center gap-3 text-xs text-muted-foreground">
        {t("lab.simplify.tolerance")}: <span className="font-semibold tabular-nums text-foreground">{tolerance} m</span>
        <input
          type="range"
          min={2}
          max={200}
          step={2}
          value={tolerance}
          onChange={(e) => setTolerance(Number(e.target.value))}
          className="flex-1 cursor-pointer accent-primary"
        />
      </label>

      <MiniMap project={project} features={features} graticuleStep={0} label="Map illustration of track simplification" className="w-full rounded-lg border" />

      <div className="grid grid-cols-3 gap-2">
        <Metric label={t("lab.simplify.before")} value={`${trail.length}`} hint={t("lab.simplify.points")} />
        <Metric label={t("lab.simplify.after")} value={`${simplified.length}`} hint={t("lab.simplify.points")} />
        <Metric label={t("lab.simplify.saved")} value={`−${reduction.toFixed(0)}%`} hint={t("lab.simplify.savedHint")} />
      </div>

      <Insight tone="solution">{t("lab.simplify.fix")}</Insight>
      <Impact>{t("lab.simplify.impact")}</Impact>
    </DemoCard>
  );
}
