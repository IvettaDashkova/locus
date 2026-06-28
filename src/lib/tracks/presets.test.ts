import { describe, it, expect } from "vitest";
import { isActivity, routeToSynthConfig, ACTIVITY_PRESETS } from "./presets";

describe("isActivity", () => {
  it("accepts known activities", () => {
    expect(isActivity("boat")).toBe(true);
    expect(isActivity("walk")).toBe(true);
  });

  it("rejects unknown values", () => {
    expect(isActivity("teleport")).toBe(false);
    expect(isActivity(42)).toBe(false);
    expect(isActivity(null)).toBe(false);
  });
});

describe("routeToSynthConfig", () => {
  it("applies the activity preset, omits elevation, caps points, and dwells at the ends", () => {
    const wp: [number, number][] = [[0, 0], [0.01, 0], [0.02, 0]];
    const cfg = routeToSynthConfig("r", "cycle", wp, new Date("2026-01-01T00:00:00Z"));
    expect(cfg.speedMps).toBe(ACTIVITY_PRESETS.cycle.speedMps);
    expect(cfg.sampleS).toBe(ACTIVITY_PRESETS.cycle.sampleS);
    expect(cfg.elevation).toBe(false);
    expect(cfg.maxPoints).toBeGreaterThan(0);
    expect(cfg.stops?.map((s) => s.atWaypoint)).toEqual([0, wp.length - 1]);
  });
});
