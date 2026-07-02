/**
 * Deterministic sample geometries for the demos. Everything is seeded (see prng) so the same shapes
 * render on the server, on the client, and in screenshots — no Math.random(), no drift.
 */
import type { LngLat } from "./types";
import { mulberry32, gaussian } from "./prng";

/**
 * A smooth ground-truth walk (a lazy S around a city block) plus a jittered "as recorded by GPS"
 * version. `sd` is the per-fix standard deviation in degrees (~0.00015° ≈ 17 m).
 */
export function noisyWalk(n = 140, sd = 0.00016, seed = 7): { truth: LngLat[]; noisy: LngLat[] } {
  const rand = mulberry32(seed);
  const truth: LngLat[] = [];
  const noisy: LngLat[] = [];
  const baseLng = 30.523;
  const baseLat = 50.45;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const lng = baseLng + t * 0.02 + Math.sin(t * Math.PI * 2) * 0.004;
    const lat = baseLat + Math.sin(t * Math.PI * 1.5) * 0.006 + t * 0.004;
    truth.push([lng, lat]);
    noisy.push([lng + gaussian(rand) * sd, lat + gaussian(rand) * sd]);
  }
  return { truth, noisy };
}

/**
 * A dense, wiggly ridge trail: a long path with far more vertices than its shape needs — the ideal
 * candidate for simplification. Returns points in [lng, lat].
 */
export function heavyTrail(n = 1200, seed = 21): LngLat[] {
  const rand = mulberry32(seed);
  const pts: LngLat[] = [];
  const baseLng = 24.0;
  const baseLat = 48.15;
  let lng = baseLng;
  let lat = baseLat;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    // A broad meander plus fine, mostly-redundant tremor.
    lng = baseLng + t * 0.4 + Math.sin(t * Math.PI * 6) * 0.03 + gaussian(rand) * 0.0004;
    lat = baseLat + Math.sin(t * Math.PI * 3) * 0.05 + Math.cos(t * Math.PI * 9) * 0.01 + gaussian(rand) * 0.0004;
    pts.push([lng, lat]);
  }
  return pts;
}

/** N points scattered in a few Gaussian blobs — a crowd worth clustering. */
export function scatterPoints(n = 4000, seed = 33): LngLat[] {
  const rand = mulberry32(seed);
  const blobs: { lng: number; lat: number; spread: number; weight: number }[] = [
    { lng: 2.35, lat: 48.86, spread: 0.5, weight: 0.4 }, // Paris
    { lng: 13.4, lat: 52.52, spread: 0.4, weight: 0.25 }, // Berlin
    { lng: 30.52, lat: 50.45, spread: 0.6, weight: 0.2 }, // Kyiv
    { lng: 21.0, lat: 52.23, spread: 0.35, weight: 0.15 }, // Warsaw
  ];
  const pts: LngLat[] = [];
  for (let i = 0; i < n; i++) {
    const pick = rand();
    let acc = 0;
    let blob = blobs[0];
    for (const b of blobs) {
      acc += b.weight;
      if (pick <= acc) {
        blob = b;
        break;
      }
    }
    pts.push([blob.lng + gaussian(rand) * blob.spread, blob.lat + gaussian(rand) * blob.spread]);
  }
  return pts;
}

/** Reference cities used to anchor the world-scale demos. */
export const CITIES: Record<string, LngLat> = {
  tokyo: [139.69, 35.69],
  sanFrancisco: [-122.42, 37.77],
  kyiv: [30.52, 50.45],
  nullIsland: [0, 0],
};
