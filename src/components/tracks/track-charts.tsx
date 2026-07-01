"use client";

import { useMemo } from "react";
import type { TrackPointRow, SegmentFeature } from "@/lib/tracks/queries";
import { trackProfile, type Fix } from "@/lib/tracks/metrics";
import { useI18n } from "@/lib/i18n/provider";

/** Lightweight dependency-free area chart in a 100×100 viewBox (stretched to fill) with a cursor. */
function MiniChart({
  x,
  y,
  color,
  cursorFrac,
}: {
  x: number[];
  y: (number | null)[];
  color: string;
  cursorFrac: number | null;
}) {
  const { area, line, cx } = useMemo(() => {
    const xs = x;
    const xMax = xs[xs.length - 1] || 1;
    const ys = y.map((v) => (v == null ? null : v));
    const valid = ys.filter((v): v is number => v != null);
    const yMin = valid.length ? Math.min(...valid) : 0;
    const yMax = valid.length ? Math.max(...valid) : 1;
    const yRange = yMax - yMin || 1;
    const px = (i: number) => (xs[i] / xMax) * 100;
    const py = (v: number) => 100 - ((v - yMin) / yRange) * 92 - 4; // 4% padding top/bottom

    // Downsample to ~300 path points: a multi-hour GPS track can hold tens of thousands of fixes,
    // and one SVG command per fix produces a huge `d` string the browser re-lays-out on every render.
    const step = Math.max(1, Math.ceil(ys.length / 300));
    const pts: string[] = [];
    for (let i = 0; i < ys.length; i += step) {
      const v = ys[i];
      if (v == null) continue;
      pts.push(`${px(i).toFixed(2)},${py(v).toFixed(2)}`);
    }
    const lineD = pts.length ? `M${pts.join(" L")}` : "";
    const areaD = pts.length ? `M${pts[0]} L${pts.join(" L")} L${px(ys.length - 1).toFixed(2)},100 L${px(0).toFixed(2)},100 Z` : "";
    return {
      line: lineD,
      area: areaD,
      cx: cursorFrac == null ? null : Math.min(100, Math.max(0, cursorFrac * 100)),
    };
  }, [x, y, cursorFrac]);

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-16 w-full">
      {area ? <path d={area} fill={color} fillOpacity={0.15} /> : null}
      {line ? (
        <path d={line} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      ) : null}
      {cx != null ? (
        <line x1={cx} y1={0} x2={cx} y2={100} stroke="currentColor" strokeWidth={1} strokeDasharray="2 2" vectorEffect="non-scaling-stroke" className="text-foreground/60" />
      ) : null}
    </svg>
  );
}

/** Move/stop timeline: one horizontal bar over elapsed time, stops highlighted, with a play cursor. */
function DwellTimeline({
  segments,
  startMs,
  endMs,
  cursorFrac,
}: {
  segments: SegmentFeature[];
  startMs: number;
  endMs: number;
  cursorFrac: number | null;
}) {
  const span = Math.max(1, endMs - startMs);
  return (
    <div className="relative h-4 w-full overflow-hidden rounded-full bg-muted">
      {segments.map((s) => {
        const left = ((new Date(s.startedAt).getTime() - startMs) / span) * 100;
        const width = (((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / span) * 100);
        return (
          <div
            key={s.seq}
            className={s.kind === "stop" ? "absolute top-0 h-full bg-amber-500/80" : "absolute top-0 h-full bg-primary/70"}
            style={{ left: `${left}%`, width: `${Math.max(0.5, width)}%` }}
            title={s.kind}
          />
        );
      })}
      {cursorFrac != null ? (
        <div className="absolute top-0 h-full w-0.5 bg-foreground" style={{ left: `${Math.min(100, Math.max(0, cursorFrac * 100))}%` }} />
      ) : null}
    </div>
  );
}

/** The three profiles for a selected track: elevation, speed, and the move/stop dwell timeline. */
export function TrackCharts({
  points,
  segments,
  pointIndex,
}: {
  points: TrackPointRow[];
  segments: SegmentFeature[];
  pointIndex: number;
}) {
  const { t } = useI18n();
  const profile = useMemo(() => {
    const fixes: Fix[] = points.map((p) => ({ lng: p.lng, lat: p.lat, ts: new Date(p.ts), elevation: p.elevation, speed: p.speed }));
    return trackProfile(fixes);
  }, [points]);

  // Stable identity for the km/h series — recomputing it inline every render busts MiniChart's memo,
  // which matters because the playback cursor re-renders TrackCharts ~60×/s.
  const speedKmh = useMemo(() => profile.speedMps.map((v) => v * 3.6), [profile]);

  if (points.length < 2) return null;
  const total = profile.cumulativeM[profile.cumulativeM.length - 1] || 1;
  const cursorFrac = profile.cumulativeM[pointIndex] != null ? profile.cumulativeM[pointIndex] / total : null;
  const hasElevation = profile.elevationM.some((v) => v != null);
  const startMs = new Date(points[0].ts).getTime();
  const endMs = new Date(points[points.length - 1].ts).getTime();
  const timeCursor =
    endMs > startMs ? (new Date(points[pointIndex]?.ts ?? points[0].ts).getTime() - startMs) / (endMs - startMs) : null;

  return (
    <div className="space-y-4">
      {hasElevation ? (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">{t("tracks.chart.elevation")}</p>
          <MiniChart x={profile.cumulativeM} y={profile.elevationM} color="#10b981" cursorFrac={cursorFrac} />
        </div>
      ) : null}
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">{t("tracks.chart.speed")}</p>
        <MiniChart x={profile.cumulativeM} y={speedKmh} color="#6d4aff" cursorFrac={cursorFrac} />
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">{t("tracks.chart.dwell")}</p>
        <DwellTimeline segments={segments} startMs={startMs} endMs={endMs} cursorFrac={timeCursor} />
      </div>
    </div>
  );
}
