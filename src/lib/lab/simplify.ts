/**
 * Ramer–Douglas–Peucker line simplification. A recorded track can carry tens of thousands of fixes;
 * shipping all of them to the client bloats payloads and melts the renderer, yet at any given zoom
 * most points sit on top of each other. RDP drops every point that lies within `toleranceM` of the
 * line kept so far, preserving the shape's corners. Perpendicular distance is measured in metres via
 * a local equirectangular projection so the tolerance is intuitive and latitude-honest.
 */
import type { LngLat } from "./types";

const R = 6_371_008.8;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Perpendicular distance (m) from point p to the segment a→b, projected around a's latitude. */
function perpDistanceM(p: LngLat, a: LngLat, b: LngLat): number {
  const cos = Math.cos(toRad(a[1]));
  const x = (v: LngLat) => toRad(v[0]) * cos * R;
  const y = (v: LngLat) => toRad(v[1]) * R;
  const px = x(p);
  const py = y(p);
  const ax = x(a);
  const ay = y(a);
  const bx = x(b);
  const by = y(b);
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  // Clamp the projection onto the segment so endpoints don't report a misleadingly large distance.
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Iterative (stack-based) RDP — avoids blowing the call stack on long tracks. */
export function simplify(points: LngLat[], toleranceM: number): LngLat[] {
  const n = points.length;
  if (n <= 2 || toleranceM <= 0) return points.map((p) => [...p] as LngLat);
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    let maxDist = 0;
    let idx = -1;
    for (let i = start + 1; i < end; i++) {
      const d = perpDistanceM(points[i], points[start], points[end]);
      if (d > maxDist) {
        maxDist = d;
        idx = i;
      }
    }
    if (maxDist > toleranceM && idx !== -1) {
      keep[idx] = 1;
      stack.push([start, idx], [idx, end]);
    }
  }
  const out: LngLat[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push([...points[i]] as LngLat);
  return out;
}
