import { describe, it, expect } from "vitest";
import { computeTrackMetrics, detectStops, trackProfile, type Fix } from "./metrics";

const at = (sec: number) => new Date(sec * 1000);

describe("computeTrackMetrics", () => {
  it("distance / duration / avg speed on a straight equator run", () => {
    const fixes: Fix[] = [
      { lng: 0, lat: 0, ts: at(0) },
      { lng: 0.001, lat: 0, ts: at(100) },
      { lng: 0.002, lat: 0, ts: at(200) },
    ];
    const { metrics } = computeTrackMetrics(fixes);
    expect(metrics.durationS).toBe(200);
    expect(metrics.distanceM).toBeCloseTo(222.4, 0);
    expect(metrics.avgSpeedMps).toBeCloseTo(1.11, 1);
    expect(metrics.stopCount).toBe(0);
    expect(metrics.legCount).toBe(1);
  });

  it("elevation gain/loss via hysteresis (threshold 0 = exact sum)", () => {
    const fixes: Fix[] = [
      { lng: 0, lat: 0, ts: at(0), elevation: 100 },
      { lng: 0.001, lat: 0, ts: at(60), elevation: 110 },
      { lng: 0.002, lat: 0, ts: at(120), elevation: 105 },
      { lng: 0.003, lat: 0, ts: at(180), elevation: 130 },
    ];
    const { metrics } = computeTrackMetrics(fixes, { elevDeadbandM: 0 });
    expect(metrics.elevationGainM).toBeCloseTo(35, 6); // 10 + 25
    expect(metrics.elevationLossM).toBeCloseTo(5, 6);
    expect(metrics.minElevationM).toBe(100);
    expect(metrics.maxElevationM).toBe(130);
  });

  it("the elevation deadband suppresses jitter but keeps a real climb", () => {
    const fixes: Fix[] = [
      { lng: 0, lat: 0, ts: at(0), elevation: 100 },
      { lng: 0.0001, lat: 0, ts: at(10), elevation: 101 }, // +1 (noise)
      { lng: 0.0002, lat: 0, ts: at(20), elevation: 99 }, //  -2 (noise)
      { lng: 0.0003, lat: 0, ts: at(30), elevation: 100 }, // +1 (noise)
      { lng: 0.0004, lat: 0, ts: at(40), elevation: 150 }, // +50 (real)
    ];
    const { metrics } = computeTrackMetrics(fixes, { elevDeadbandM: 3 });
    expect(metrics.elevationGainM).toBeCloseTo(50, 0); // jitter ignored, climb counted
    expect(metrics.elevationLossM).toBe(0);
  });

  it("returns empty metrics for fewer than two points", () => {
    expect(computeTrackMetrics([{ lng: 0, lat: 0, ts: at(0) }]).metrics.pointCount).toBe(1);
    expect(computeTrackMetrics([]).segments).toEqual([]);
  });
});

describe("detectStops", () => {
  const dwell: Fix[] = [
    { lng: 0, lat: 0, ts: at(0) },
    { lng: 0, lat: 0, ts: at(30) },
    { lng: 0, lat: 0, ts: at(60) },
    { lng: 0, lat: 0, ts: at(90) },
    { lng: 0, lat: 0, ts: at(120) },
    { lng: 0.001, lat: 0, ts: at(150) },
    { lng: 0.002, lat: 0, ts: at(180) },
  ];

  it("detects a clustered dwell that meets the min-dwell gate", () => {
    expect(detectStops(dwell, { radiusM: 25, minDwellS: 120 })).toHaveLength(1);
  });

  it("ignores a dwell below the min-dwell gate", () => {
    const short: Fix[] = [
      { lng: 0, lat: 0, ts: at(0) },
      { lng: 0, lat: 0, ts: at(30) },
      { lng: 0, lat: 0, ts: at(60) },
      { lng: 0.001, lat: 0, ts: at(90) },
    ];
    expect(detectStops(short, { radiusM: 25, minDwellS: 120 })).toHaveLength(0);
  });

  it("splits a track into a stop + a move leg with the right stopped time", () => {
    const { metrics } = computeTrackMetrics(dwell, { radiusM: 25, minDwellS: 120 });
    expect(metrics.stopCount).toBe(1);
    expect(metrics.legCount).toBe(1);
    expect(metrics.stoppedTimeS).toBeCloseTo(120, 6);
  });
});

describe("trackProfile", () => {
  it("produces aligned cumulative / speed / elevation series", () => {
    const fixes: Fix[] = [
      { lng: 0, lat: 0, ts: at(0), elevation: 10 },
      { lng: 0.001, lat: 0, ts: at(100), elevation: 20 },
    ];
    const p = trackProfile(fixes);
    expect(p.cumulativeM).toHaveLength(2);
    expect(p.cumulativeM[0]).toBe(0);
    expect(p.cumulativeM[1]).toBeGreaterThan(111);
    expect(p.elevationM).toEqual([10, 20]);
    expect(p.speedMps[1]).toBeGreaterThan(1.0);
  });
});
