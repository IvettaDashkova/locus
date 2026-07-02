/**
 * The ±180° meridian (the dateline) is where longitude wraps. A line from Tokyo (139°E) to San
 * Francisco (122°W) is short across the Pacific, but stored as raw longitudes its endpoints differ by
 * 261°, so a naive renderer draws it the *long* way — a streak straight across the whole map. Two
 * standard fixes: unwrap the longitudes into a continuous run, or split the line at the dateline into
 * segments each renderer can draw locally. Both are provided.
 */
import type { LngLat } from "./types";

/**
 * Shift each longitude by whole turns of 360° so consecutive points never jump more than 180°. The
 * result may contain longitudes outside [-180, 180] (e.g. 238° for San Francisco after Tokyo) — which
 * is exactly what a single continuous polyline needs.
 */
export function unwrapLongitudes(points: LngLat[]): LngLat[] {
  if (points.length === 0) return [];
  const out: LngLat[] = [[points[0][0], points[0][1]]];
  for (let i = 1; i < points.length; i++) {
    const prev = out[i - 1][0];
    let lng = points[i][0];
    while (lng - prev > 180) lng -= 360;
    while (lng - prev < -180) lng += 360;
    out.push([lng, points[i][1]]);
  }
  return out;
}

/**
 * Split a polyline into runs that never cross the dateline, inserting the boundary crossing point on
 * both sides (latitude linearly interpolated). Feed each returned run to the renderer separately.
 */
export function splitAntimeridian(points: LngLat[]): LngLat[][] {
  if (points.length < 2) return points.length ? [points.map((p) => [...p] as LngLat)] : [];
  const runs: LngLat[][] = [];
  let current: LngLat[] = [[points[0][0], points[0][1]]];
  for (let i = 1; i < points.length; i++) {
    const [lng1, lat1] = points[i - 1];
    const [lng2, lat2] = points[i];
    if (Math.abs(lng2 - lng1) > 180) {
      // A crossing. Work out which edge (+180 leaving east, -180 leaving west) and the crossing lat.
      const goingEast = lng2 < lng1; // e.g. 170 -> -170 means the short way is eastward over +180
      const edgeFrom = goingEast ? 180 : -180;
      const edgeTo = goingEast ? -180 : 180;
      // Fraction along the segment (in unwrapped space) where it hits the edge.
      const adj = goingEast ? lng2 + 360 : lng2 - 360;
      const t = (edgeFrom - lng1) / (adj - lng1);
      const latEdge = lat1 + t * (lat2 - lat1);
      current.push([edgeFrom, latEdge]);
      runs.push(current);
      current = [[edgeTo, latEdge], [lng2, lat2]];
    } else {
      current.push([lng2, lat2]);
    }
  }
  runs.push(current);
  return runs;
}
