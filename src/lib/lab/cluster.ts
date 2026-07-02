/**
 * Grid clustering. Dropping every one of N points onto the map as its own marker means N DOM nodes or
 * N draw calls — a few thousand and panning stutters, plus overlapping pins are unreadable anyway.
 * Snapping points to a fixed grid and drawing one weighted marker per occupied cell collapses that to
 * at most (cells on screen) markers, in a single O(N) pass. The cell size is what a real map would
 * derive from the current zoom; here it's an explicit knob so the trade-off is visible.
 */
import type { LngLat } from "./types";

export type Cluster = { lng: number; lat: number; count: number };

/**
 * Bucket points into `cellDeg`-sized grid cells; each cluster sits at the mean of its members so it
 * reads as "the centre of this crowd", and carries the member count for sizing/labelling.
 */
export function gridCluster(points: LngLat[], cellDeg: number): Cluster[] {
  if (cellDeg <= 0) return points.map(([lng, lat]) => ({ lng, lat, count: 1 }));
  const cells = new Map<string, { lng: number; lat: number; count: number }>();
  for (const [lng, lat] of points) {
    const gx = Math.floor(lng / cellDeg);
    const gy = Math.floor(lat / cellDeg);
    const key = `${gx}:${gy}`;
    const cell = cells.get(key);
    if (cell) {
      cell.lng += lng;
      cell.lat += lat;
      cell.count += 1;
    } else {
      cells.set(key, { lng, lat, count: 1 });
    }
  }
  return Array.from(cells.values(), (c) => ({
    lng: c.lng / c.count,
    lat: c.lat / c.count,
    count: c.count,
  }));
}
