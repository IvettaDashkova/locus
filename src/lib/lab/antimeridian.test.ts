import { describe, expect, it } from "vitest";
import { unwrapLongitudes, splitAntimeridian } from "./antimeridian";
import type { LngLat } from "./types";

const TOKYO: LngLat = [139.7, 35.7];
const SF: LngLat = [-122.4, 37.8];

describe("unwrapLongitudes", () => {
  it("makes consecutive longitude deltas ≤ 180°", () => {
    const out = unwrapLongitudes([TOKYO, SF]);
    for (let i = 1; i < out.length; i++) {
      expect(Math.abs(out[i][0] - out[i - 1][0])).toBeLessThanOrEqual(180);
    }
  });

  it("pushes San Francisco past 180° so the line goes the short (Pacific) way", () => {
    const out = unwrapLongitudes([TOKYO, SF]);
    expect(out[1][0]).toBeGreaterThan(180);
    expect(out[1][0]).toBeCloseTo(237.6, 5);
  });

  it("leaves a line that never crosses the dateline untouched", () => {
    const line: LngLat[] = [[10, 0], [20, 0], [30, 0]];
    expect(unwrapLongitudes(line)).toEqual(line);
  });
});

describe("splitAntimeridian", () => {
  it("splits a dateline-crossing line into two runs meeting at ±180", () => {
    const runs = splitAntimeridian([TOKYO, SF]);
    expect(runs).toHaveLength(2);
    expect(runs[0].at(-1)![0]).toBe(180);
    expect(runs[1][0][0]).toBe(-180);
    // The crossing latitude is shared by both runs.
    expect(runs[0].at(-1)![1]).toBeCloseTo(runs[1][0][1], 10);
  });

  it("interpolates a plausible crossing latitude between the endpoints", () => {
    const runs = splitAntimeridian([TOKYO, SF]);
    const lat = runs[0].at(-1)![1];
    expect(lat).toBeGreaterThan(Math.min(TOKYO[1], SF[1]));
    expect(lat).toBeLessThan(Math.max(TOKYO[1], SF[1]));
  });

  it("returns a single run when nothing crosses", () => {
    const line: LngLat[] = [[10, 0], [20, 5], [30, 0]];
    const runs = splitAntimeridian(line);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toHaveLength(3);
  });
});
