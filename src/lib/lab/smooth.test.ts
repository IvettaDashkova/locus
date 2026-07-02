import { describe, expect, it } from "vitest";
import { movingAverage, ema, kalmanSmooth, pathLengthM } from "./smooth";
import { mulberry32, gaussian } from "./prng";
import type { LngLat } from "./types";

/** A straight line east along the equator with seeded Gaussian jitter added to every fix. */
function noisyLine(n: number, sd: number): { truth: LngLat[]; noisy: LngLat[] } {
  const rand = mulberry32(99);
  const truth: LngLat[] = [];
  const noisy: LngLat[] = [];
  for (let i = 0; i < n; i++) {
    // Step per fix (~0.00012° ≈ 13 m) is on the same scale as the jitter, as it is for a real walk
    // logged roughly once a second — which is exactly why the noise dominates the measured length.
    const lng = i * 0.00012;
    truth.push([lng, 0]);
    noisy.push([lng + gaussian(rand) * sd, gaussian(rand) * sd]);
  }
  return { truth, noisy };
}

describe("pathLengthM", () => {
  it("is 0 for a single point and additive along a line", () => {
    expect(pathLengthM([[0, 0]])).toBe(0);
    const len = pathLengthM([[0, 0], [0.001, 0], [0.002, 0]]);
    expect(len).toBeGreaterThan(0);
  });

  it("shows jitter inflates measured distance, and smoothing removes most of it", () => {
    const { truth, noisy } = noisyLine(200, 0.0002);
    const truthLen = pathLengthM(truth);
    const noisyLen = pathLengthM(noisy);
    const smoothLen = pathLengthM(kalmanSmooth(noisy));
    expect(noisyLen).toBeGreaterThan(truthLen * 1.2); // jitter clearly inflates
    expect(smoothLen).toBeLessThan(noisyLen); // filter recovers most of the excess
  });
});

describe("smoothers", () => {
  it("all preserve the number of points", () => {
    const { noisy } = noisyLine(50, 0.0002);
    expect(movingAverage(noisy, 5)).toHaveLength(50);
    expect(ema(noisy, 0.3)).toHaveLength(50);
    expect(kalmanSmooth(noisy)).toHaveLength(50);
  });

  it("movingAverage with window 1 is a no-op copy", () => {
    const pts: LngLat[] = [[1, 2], [3, 4]];
    const out = movingAverage(pts, 1);
    expect(out).toEqual(pts);
    expect(out).not.toBe(pts);
  });

  it("reduce scatter around the truth (lower RMS error than raw)", () => {
    const { truth, noisy } = noisyLine(200, 0.0002);
    const rms = (a: LngLat[]) =>
      Math.sqrt(a.reduce((s, p, i) => s + (p[1] - truth[i][1]) ** 2, 0) / a.length);
    const raw = rms(noisy);
    expect(rms(movingAverage(noisy, 7))).toBeLessThan(raw);
    expect(rms(kalmanSmooth(noisy))).toBeLessThan(raw);
  });

  it("empty input yields empty output", () => {
    expect(kalmanSmooth([])).toEqual([]);
    expect(ema([], 0.5)).toEqual([]);
    expect(movingAverage([], 5)).toEqual([]);
  });
});
