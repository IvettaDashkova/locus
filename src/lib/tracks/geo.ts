/**
 * Pure spherical-geometry helpers for trajectory analytics. Deliberately dependency-free and exact
 * so the metrics built on them can be checked against hand-calculated examples (see metrics tests).
 * All angles in degrees, distances in metres. WGS84 mean Earth radius.
 */

export const EARTH_RADIUS_M = 6_371_008.8;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle (haversine) distance in metres between two [lng, lat] points. */
export function haversineM(a: [number, number], b: [number, number]): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Mean of a set of [lng, lat] points — good enough as a stop centroid at city/trail scale. */
export function centroid(points: [number, number][]): [number, number] {
  let lng = 0;
  let lat = 0;
  for (const [x, y] of points) {
    lng += x;
    lat += y;
  }
  return [lng / points.length, lat / points.length];
}
