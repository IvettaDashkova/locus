/**
 * Why "just use Pythagoras on lat/lng" is a bug. A degree of latitude is ~111 km everywhere, but a
 * degree of longitude shrinks by cos(latitude) — 111 km at the equator, ~78 km in Kyiv, ~0 at the
 * poles. Treating degrees as a flat plane with a single scale ignores that, so east–west distances
 * come out too long and the error grows with latitude. `naivePlanarM` reproduces the mistake so it
 * can be shown side by side with the correct great-circle value (`haversineM` from tracks/geo).
 */
import type { LngLat } from "./types";
import { haversineM } from "../tracks/geo";

/** Metres per degree of latitude (constant); the naive method wrongly applies it to longitude too. */
export const M_PER_DEG = 111_320;

/** The buggy flat-earth distance: Euclidean on raw degrees, one scale for both axes. */
export function naivePlanarM(a: LngLat, b: LngLat): number {
  const dLng = b[0] - a[0];
  const dLat = b[1] - a[1];
  return Math.hypot(dLng, dLat) * M_PER_DEG;
}

/** Signed error of the naive method versus the truth, as a fraction (e.g. 0.23 = 23% too long). */
export function planarErrorFraction(a: LngLat, b: LngLat): number {
  const truth = haversineM(a, b);
  if (truth === 0) return 0;
  return (naivePlanarM(a, b) - truth) / truth;
}

export { haversineM };
