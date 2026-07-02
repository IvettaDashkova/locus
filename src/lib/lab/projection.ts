/**
 * The two projections the lab's SVG mini-maps draw with.
 *
 * `worldToXY` / `xyToWorld` — a plain equirectangular (plate carrée) mapping of the whole globe into a
 * box. Used by the world-scale demos (lat/lng swap, antimeridian) because it shows all 360° at once.
 *
 * `project` / `unproject` — a slippy-map style Web Mercator viewport (a centre, a zoom, a pixel box),
 * used by the deep-linkable viewport demo so pan/zoom behave like every real web map.
 */
import type { LngLat } from "./types";

// --- Equirectangular whole-world ---

export function worldToXY(p: LngLat, width: number, height: number): [number, number] {
  const x = ((p[0] + 180) / 360) * width;
  const y = ((90 - p[1]) / 180) * height;
  return [x, y];
}

export function xyToWorld(px: [number, number], width: number, height: number): LngLat {
  const lng = (px[0] / width) * 360 - 180;
  const lat = 90 - (px[1] / height) * 180;
  return [lng, lat];
}

/**
 * Fit a set of points into a `width`×`height` box with an equal, map-honest scale: longitude is
 * squeezed by cos(latitude) so the shape isn't stretched east–west, and one scale is used on both
 * axes so angles and proportions survive. Returns a `project` for the local-scale demos.
 */
export function fitProjection(
  points: LngLat[],
  width: number,
  height: number,
  pad = 26,
): (p: LngLat) => [number, number] {
  const lats = points.map((p) => p[1]);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const k = Math.cos((midLat * Math.PI) / 180) || 1e-6;
  const xs = points.map((p) => p[0] * k);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1e-6;
  const spanY = maxY - minY || 1e-6;
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
  // Centre the drawing in the leftover space.
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  return ([lng, lat]) => [
    offX + (lng * k - minX) * scale,
    // Flip Y so north is up.
    offY + (maxY - lat) * scale,
  ];
}

// --- Web Mercator viewport ---

export type Viewport = { center: LngLat; zoom: number; width: number; height: number };

const TILE = 256;
const clampLat = (lat: number) => Math.max(-85.05112878, Math.min(85.05112878, lat));

/** World pixel coordinate of a lng/lat at a given zoom (Mercator, origin top-left of the world). */
function worldPx(p: LngLat, zoom: number): [number, number] {
  const size = TILE * 2 ** zoom;
  const x = ((p[0] + 180) / 360) * size;
  const s = Math.sin((clampLat(p[1]) * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * size;
  return [x, y];
}

/** Project a lng/lat to a pixel within the viewport box (centre of the box = viewport centre). */
export function project(p: LngLat, vp: Viewport): [number, number] {
  const [wx, wy] = worldPx(p, vp.zoom);
  const [cx, cy] = worldPx(vp.center, vp.zoom);
  return [wx - cx + vp.width / 2, wy - cy + vp.height / 2];
}

/** Inverse of `project`: a pixel within the viewport box back to lng/lat. */
export function unproject(px: [number, number], vp: Viewport): LngLat {
  const size = TILE * 2 ** vp.zoom;
  const [cx, cy] = worldPx(vp.center, vp.zoom);
  const wx = px[0] - vp.width / 2 + cx;
  const wy = px[1] - vp.height / 2 + cy;
  const lng = (wx / size) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * wy) / size;
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return [lng, lat];
}
