/**
 * GPS de-noising. A consumer-grade receiver reports a position that scatters a few metres around the
 * truth every second; drawn raw, the track is a fuzzy caterpillar and its length is badly inflated
 * (every jitter adds a there-and-back). These are the three filters people actually reach for, from
 * cheapest to smartest. All operate on [lng, lat] fixes and each lng/lat channel independently.
 */
import type { LngLat } from "./types";
import { haversineM } from "../tracks/geo";

/** Centred moving average over an odd-ish window. Simple, but lags on turns and blunts corners. */
export function movingAverage(points: LngLat[], window: number): LngLat[] {
  if (window <= 1 || points.length === 0) return points.map((p) => [...p] as LngLat);
  const half = Math.floor(window / 2);
  return points.map((_, i) => {
    let lng = 0;
    let lat = 0;
    let n = 0;
    for (let j = i - half; j <= i + half; j++) {
      if (j < 0 || j >= points.length) continue;
      lng += points[j][0];
      lat += points[j][1];
      n++;
    }
    return [lng / n, lat / n] as LngLat;
  });
}

/** Exponential moving average. One weight (alpha ∈ (0,1]); lower = smoother but laggier. Causal. */
export function ema(points: LngLat[], alpha: number): LngLat[] {
  const a = Math.min(1, Math.max(0.001, alpha));
  const out: LngLat[] = [];
  let prev: LngLat | null = null;
  for (const p of points) {
    if (!prev) {
      prev = [p[0], p[1]];
    } else {
      prev = [prev[0] + a * (p[0] - prev[0]), prev[1] + a * (p[1] - prev[1])];
    }
    out.push([prev[0], prev[1]]);
  }
  return out;
}

/**
 * A constant-position 1-D Kalman filter per axis. `q` is process noise (how much the true position is
 * expected to move between fixes), `r` is measurement noise (how much you distrust each reading).
 * Unlike a fixed window it adapts: confident readings pull hard, noisy ones barely move the estimate.
 */
export function kalmanSmooth(points: LngLat[], q = 1e-6, r = 1e-4): LngLat[] {
  if (points.length === 0) return [];
  const filterAxis = (values: number[]): number[] => {
    let x = values[0];
    let p = 1;
    const out: number[] = [];
    for (const z of values) {
      // Predict: variance grows by the process noise.
      p += q;
      // Update: blend prediction and measurement by the Kalman gain.
      const k = p / (p + r);
      x += k * (z - x);
      p *= 1 - k;
      out.push(x);
    }
    return out;
  };
  const lng = filterAxis(points.map((p) => p[0]));
  const lat = filterAxis(points.map((p) => p[1]));
  return points.map((_, i) => [lng[i], lat[i]] as LngLat);
}

/** Total great-circle length of a polyline in metres — used to show jitter-inflated distance. */
export function pathLengthM(points: LngLat[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversineM(points[i - 1], points[i]);
  return total;
}
