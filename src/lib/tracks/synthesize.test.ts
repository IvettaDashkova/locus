import { describe, it, expect } from "vitest";
import { synthesizeTrack, type SynthConfig } from "./synthesize";

const base: SynthConfig = {
  name: "t",
  activity: "walk",
  waypoints: [[0, 0], [0.01, 0.01]],
  speedMps: 1.3,
  sampleS: 5,
  startTime: new Date("2026-01-01T00:00:00Z"),
  baseElevationM: 0,
  elevationAmpM: 0,
  seed: 42,
};

describe("synthesizeTrack", () => {
  it("is deterministic for the same seed", () => {
    const a = synthesizeTrack(base);
    const b = synthesizeTrack(base);
    expect(a.points.length).toBe(b.points.length);
    expect(a.points[0]).toEqual(b.points[0]);
    expect(a.points.at(-1)).toEqual(b.points.at(-1));
  });

  it("differs for a different seed", () => {
    const a = synthesizeTrack(base);
    const b = synthesizeTrack({ ...base, seed: 99 });
    expect(a.points[1]).not.toEqual(b.points[1]);
  });

  it("omits elevation when elevation:false (drawn routes have unknown terrain)", () => {
    const t = synthesizeTrack({ ...base, elevation: false });
    expect(t.points.every((p) => p.elevation == null)).toBe(true);
  });

  it("caps the fix count via maxPoints on a very long route", () => {
    const huge = synthesizeTrack({
      ...base,
      waypoints: [[-30, 40], [40, 30]], // thousands of km
      speedMps: 13,
      sampleS: 3,
      maxPoints: 1000,
    });
    expect(huge.points.length).toBeGreaterThan(100);
    expect(huge.points.length).toBeLessThanOrEqual(1100);
  });
});
