"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { Link2, Plus, Minus, Copy, RotateCcw, Check } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import { project, unproject, type Viewport } from "@/lib/lab/projection";
import { CITIES } from "@/lib/lab/fixtures";
import type { LngLat } from "@/lib/lab/types";
import { Button } from "@/components/ui/button";
import { DemoCard, Insight, LAB_COLORS } from "../demo-card";
import { MiniMap, type MiniFeature } from "../mini-map";

const W = 760;
const H = 380;
const DEFAULT_CENTER: LngLat = [15, 50];
const DEFAULT_ZOOM = 3.4;
const PARAM = "v";

const PINS: MiniFeature[] = [
  { kind: "pin", coord: CITIES.kyiv, color: LAB_COLORS.solution, label: "Kyiv" },
  { kind: "pin", coord: CITIES.tokyo, color: LAB_COLORS.neutral, label: "Tokyo" },
  { kind: "pin", coord: CITIES.sanFrancisco, color: LAB_COLORS.neutral, label: "San Francisco" },
  { kind: "pin", coord: [2.35, 48.86], color: LAB_COLORS.neutral, label: "Paris" },
  { kind: "pin", coord: [-0.13, 51.51], color: LAB_COLORS.neutral, label: "London" },
  { kind: "pin", coord: [13.4, 52.52], color: LAB_COLORS.neutral, label: "Berlin" },
];

/** Serialise a viewport as "lng,lat,zoom" with just enough precision to restore the view. */
const encode = (c: LngLat, z: number) => `${c[0].toFixed(4)},${c[1].toFixed(4)},${z.toFixed(2)}`;

export function ViewportUrlDemo({ index }: { index: number }) {
  const { t } = useI18n();
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [center, setCenter] = useState<LngLat>(DEFAULT_CENTER);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [grabbing, setGrabbing] = useState(false);
  const [copied, setCopied] = useState(false);

  // On mount, restore the view from the URL if a ?v=lng,lat,zoom is present — the whole point of the demo.
  // Reading window is client-only, so this is a one-shot mount sync (same pattern as the i18n provider).
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get(PARAM);
    if (!raw) return;
    const [lng, lat, z] = raw.split(",").map(Number);
    if ([lng, lat, z].every((n) => Number.isFinite(n))) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCenter([lng, lat]);
      setZoom(z);
    }
  }, []);

  // Mirror the current view into the URL (replaceState — no navigation, no history spam), debounced.
  useEffect(() => {
    const id = setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.set(PARAM, encode(center, zoom));
      window.history.replaceState(null, "", url);
    }, 200);
    return () => clearTimeout(id);
  }, [center, zoom]);

  const vp: Viewport = { center, zoom, width: W, height: H };

  // Convert a client-pixel delta to viewBox units (the SVG scales to its container width).
  const toViewBox = useCallback((px: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    return rect ? px * (W / rect.width) : px;
  }, []);

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    drag.current = { x: e.clientX, y: e.clientY };
    setGrabbing(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    const dx = toViewBox(e.clientX - drag.current.x);
    const dy = toViewBox(e.clientY - drag.current.y);
    drag.current = { x: e.clientX, y: e.clientY };
    // Move the centre so the map content follows the cursor.
    setCenter(unproject([W / 2 - dx, H / 2 - dy], vp));
  };
  const endDrag = (e: PointerEvent<SVGSVGElement>) => {
    drag.current = null;
    setGrabbing(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
  };
  const onWheel = (e: WheelEvent<SVGSVGElement>) => {
    setZoom((z) => Math.max(1, Math.min(11, z - Math.sign(e.deltaY) * 0.4)));
  };
  const bump = (d: number) => setZoom((z) => Math.max(1, Math.min(11, z + d)));

  const reset = () => {
    setCenter(DEFAULT_CENTER);
    setZoom(DEFAULT_ZOOM);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the URL bar already reflects the view */
    }
  };

  return (
    <DemoCard index={index} icon={<Link2 className="size-5" />} title={t("lab.viewport.title")} blurb={t("lab.viewport.blurb")}>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={copy} className="gap-1.5">
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? t("lab.viewport.copied") : t("lab.viewport.copy")}
        </Button>
        <Button size="sm" variant="ghost" onClick={reset} className="gap-1.5">
          <RotateCcw className="size-3.5" />
          {t("lab.viewport.reset")}
        </Button>
        <div className="ml-auto flex items-center gap-1">
          <Button size="icon-sm" variant="outline" onClick={() => bump(-0.5)} aria-label="Zoom out">
            <Minus className="size-4" />
          </Button>
          <Button size="icon-sm" variant="outline" onClick={() => bump(0.5)} aria-label="Zoom in">
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      <MiniMap
        ref={svgRef}
        project={(p) => project(p, vp)}
        features={PINS}
        width={W}
        height={H}
        graticuleStep={10}
        cursor={grabbing ? "grabbing" : "grab"}
        className="w-full touch-none rounded-lg border select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onWheel={onWheel}
      />

      <p className="rounded-md bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
        ?{PARAM}={encode(center, zoom)}
      </p>

      <Insight tone="solution">{t("lab.viewport.fix")}</Insight>
    </DemoCard>
  );
}
