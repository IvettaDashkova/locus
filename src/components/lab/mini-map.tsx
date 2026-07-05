"use client";

import { forwardRef, type PointerEvent, type WheelEvent } from "react";
import type { LngLat } from "@/lib/lab/types";

/**
 * A dependency-free SVG "mini map". It knows nothing about tiles or MapLibre — it just projects
 * [lng, lat] geometry with whatever `project` function the demo hands it (equirectangular for
 * world-scale demos, Web Mercator for the pannable one) and draws a graticule backdrop. Keeping it
 * self-contained makes every demo deterministic and offline: no network, no flakiness, same picture
 * every time.
 */

export type MiniFeature =
  | { kind: "line"; coords: LngLat[]; color: string; width?: number; dash?: string; opacity?: number }
  | { kind: "dots"; coords: LngLat[]; color: string; radius?: number; opacity?: number }
  | { kind: "pin"; coord: LngLat; color: string; label?: string; sub?: string }
  | { kind: "cluster"; coord: LngLat; count: number; color: string };

type Props = {
  width?: number;
  height?: number;
  project: (p: LngLat) => [number, number];
  features: MiniFeature[];
  /** Graticule density in degrees; 0 hides it. World demos use 30, local demos a finer grid. */
  graticuleStep?: number;
  /** Accessible name for the SVG (role="img" requires one — becomes a <title> + aria-label). */
  label?: string;
  className?: string;
  cursor?: string;
  onPointerDown?: (e: PointerEvent<SVGSVGElement>) => void;
  onPointerMove?: (e: PointerEvent<SVGSVGElement>) => void;
  onPointerUp?: (e: PointerEvent<SVGSVGElement>) => void;
  onPointerLeave?: (e: PointerEvent<SVGSVGElement>) => void;
  onWheel?: (e: WheelEvent<SVGSVGElement>) => void;
};

const path = (pts: [number, number][]) =>
  pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

export const MiniMap = forwardRef<SVGSVGElement, Props>(function MiniMap(
  { width = 760, height = 380, project, features, graticuleStep = 30, label = "Map illustration", className, cursor, ...handlers },
  ref,
) {
  // Build the graticule by sampling each meridian/parallel and projecting the samples, so it bends
  // correctly under Mercator and stays straight under equirectangular — one code path for both.
  const grat: { d: string; major: boolean }[] = [];
  if (graticuleStep > 0) {
    for (let lng = -180; lng <= 180; lng += graticuleStep) {
      const pts: [number, number][] = [];
      for (let lat = -80; lat <= 80; lat += 10) pts.push(project([lng, lat]));
      grat.push({ d: path(pts), major: lng === 0 || Math.abs(lng) === 180 });
    }
    for (let lat = -80; lat <= 80; lat += graticuleStep) {
      const pts: [number, number][] = [];
      for (let lng = -180; lng <= 180; lng += 10) pts.push(project([lng, lat]));
      grat.push({ d: path(pts), major: lat === 0 });
    }
  }

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ cursor, touchAction: "none" }}
      role="img"
      aria-label={label}
      {...handlers}
    >
      <title>{label}</title>
      <rect x={0} y={0} width={width} height={height} className="fill-muted/40" rx={10} />
      <g className="text-foreground">
        {grat.map((g, i) => (
          <path
            key={i}
            d={g.d}
            fill="none"
            stroke="currentColor"
            strokeWidth={g.major ? 1 : 0.6}
            opacity={g.major ? 0.22 : 0.1}
          />
        ))}
      </g>

      {features.map((f, i) => {
        if (f.kind === "line") {
          return (
            <path
              key={i}
              d={path(f.coords.map(project))}
              fill="none"
              stroke={f.color}
              strokeWidth={f.width ?? 2.5}
              strokeDasharray={f.dash}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={f.opacity ?? 1}
            />
          );
        }
        if (f.kind === "dots") {
          return (
            <g key={i} opacity={f.opacity ?? 1}>
              {f.coords.map((c, j) => {
                const [x, y] = project(c);
                return <circle key={j} cx={x} cy={y} r={f.radius ?? 1.6} fill={f.color} />;
              })}
            </g>
          );
        }
        if (f.kind === "cluster") {
          const [x, y] = project(f.coord);
          const r = Math.min(26, 6 + Math.sqrt(f.count) * 1.4);
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={r} fill={f.color} opacity={0.28} />
              <circle cx={x} cy={y} r={r * 0.62} fill={f.color} opacity={0.9} />
              <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} fill="#fff">
                {f.count}
              </text>
            </g>
          );
        }
        // pin
        const [x, y] = project(f.coord);
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={5} fill={f.color} stroke="#fff" strokeWidth={1.5} />
            {f.label ? (
              <text x={x + 9} y={y - 5} fontSize={12} fontWeight={600} className="fill-foreground">
                {f.label}
              </text>
            ) : null}
            {f.sub ? (
              <text x={x + 9} y={y + 8} fontSize={10} className="fill-muted-foreground">
                {f.sub}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
});
