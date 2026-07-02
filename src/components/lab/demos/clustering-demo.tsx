"use client";

import { useMemo, useState } from "react";
import { Layers } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import { scatterPoints } from "@/lib/lab/fixtures";
import { gridCluster } from "@/lib/lab/cluster";
import { fitProjection } from "@/lib/lab/projection";
import { DemoCard, Insight, Metric, Segmented, LAB_COLORS } from "../demo-card";
import { MiniMap, type MiniFeature } from "../mini-map";

export function ClusteringDemo({ index }: { index: number }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"all" | "cluster">("all");
  const [cell, setCell] = useState(1.2);

  const points = useMemo(() => scatterPoints(4000), []);
  const clusters = useMemo(() => gridCluster(points, cell), [points, cell]);
  const project = useMemo(() => fitProjection(points, 760, 380), [points]);

  const all = mode === "all";
  const rendered = all ? points.length : clusters.length;

  const features: MiniFeature[] = all
    ? [{ kind: "dots", coords: points, color: LAB_COLORS.problem, radius: 1.3, opacity: 0.5 }]
    : clusters.map((c) => ({ kind: "cluster" as const, coord: [c.lng, c.lat], count: c.count, color: LAB_COLORS.solution }));

  return (
    <DemoCard index={index} icon={<Layers className="size-5" />} title={t("lab.cluster.title")} blurb={t("lab.cluster.blurb")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          ariaLabel={t("lab.cluster.title")}
          value={mode}
          onChange={setMode}
          options={[
            { value: "all", label: t("lab.cluster.all"), tone: "problem" },
            { value: "cluster", label: t("lab.cluster.clustered"), tone: "solution" },
          ]}
        />
        {!all ? (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            {t("lab.cluster.cell")}
            <input
              type="range"
              min={0.4}
              max={3}
              step={0.1}
              value={cell}
              onChange={(e) => setCell(Number(e.target.value))}
              className="w-28 cursor-pointer accent-primary"
            />
          </label>
        ) : null}
      </div>

      <MiniMap project={project} features={features} width={760} height={380} graticuleStep={10} className="w-full rounded-lg border" />

      <div className="grid grid-cols-2 gap-2">
        <Metric label={t("lab.cluster.points")} value={points.length.toLocaleString()} hint={t("lab.cluster.pointsHint")} />
        <Metric
          label={t("lab.cluster.rendered")}
          value={rendered.toLocaleString()}
          hint={all ? t("lab.cluster.renderedBad") : t("lab.cluster.renderedGood")}
        />
      </div>

      {all ? (
        <Insight tone="problem">{t("lab.cluster.problem")}</Insight>
      ) : (
        <Insight tone="solution">{t("lab.cluster.fix")}</Insight>
      )}
    </DemoCard>
  );
}
