import type { CheckResult, EvalCase, Suite } from "../types";
import { computeTrackMetrics, detectStops, type Fix } from "@/lib/tracks/metrics";
import { haversineM } from "@/lib/tracks/geo";
import { parseGpx } from "@/lib/tracks/parse";

/**
 * Tracks suite — the analytics are pure functions, so these are exact checks against
 * HAND-CALCULATED examples (no LLM, always runnable). Each case states the expected number and the
 * reasoning, then asserts the metrics service matches within a tight tolerance.
 */

const at = (sec: number): Date => new Date(sec * 1000);
const approx = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

// 0.001° of longitude at the equator ≈ R·Δλ = 6 371 008.8 · (0.001·π/180) ≈ 111.19 m.
const STEP_M = haversineM([0, 0], [0.001, 0]);

const distanceCase: EvalCase = {
  name: "distance + duration + avg speed (straight equator run)",
  run: async (): Promise<CheckResult[]> => {
    // Three fixes, two equal 0.001° legs, 100 s apart → ~222.4 m over 200 s, no stop.
    const fixes: Fix[] = [
      { lng: 0, lat: 0, ts: at(0) },
      { lng: 0.001, lat: 0, ts: at(100) },
      { lng: 0.002, lat: 0, ts: at(200) },
    ];
    const { metrics } = computeTrackMetrics(fixes);
    const expDist = STEP_M * 2;
    const expAvg = expDist / 200;
    return [
      { metric: "distance_m", pass: approx(metrics.distanceM, expDist, 0.5), score: Math.round(metrics.distanceM), note: `exp ${expDist.toFixed(1)}` },
      { metric: "duration_s", pass: metrics.durationS === 200, score: metrics.durationS },
      { metric: "avg_speed_mps", pass: approx(metrics.avgSpeedMps, expAvg, 0.01), score: Number(metrics.avgSpeedMps.toFixed(3)) },
      { metric: "no_false_stop", pass: metrics.stopCount === 0 && metrics.legCount === 1, note: `${metrics.stopCount} stops / ${metrics.legCount} legs` },
    ];
  },
};

const elevationCase: EvalCase = {
  name: "elevation gain/loss (hand-summed profile)",
  run: async (): Promise<CheckResult[]> => {
    // Elevations 100→110→105→130: gain = 10 + 25 = 35, loss = 5, range 100–130.
    const fixes: Fix[] = [
      { lng: 0, lat: 0, ts: at(0), elevation: 100 },
      { lng: 0.001, lat: 0, ts: at(60), elevation: 110 },
      { lng: 0.002, lat: 0, ts: at(120), elevation: 105 },
      { lng: 0.003, lat: 0, ts: at(180), elevation: 130 },
    ];
    const { metrics } = computeTrackMetrics(fixes, { elevDeadbandM: 0 });
    return [
      { metric: "elevation_gain_m", pass: approx(metrics.elevationGainM, 35, 1e-6), score: metrics.elevationGainM },
      { metric: "elevation_loss_m", pass: approx(metrics.elevationLossM, 5, 1e-6), score: metrics.elevationLossM },
      { metric: "elevation_range", pass: metrics.minElevationM === 100 && metrics.maxElevationM === 130, note: `${metrics.minElevationM}–${metrics.maxElevationM}` },
    ];
  },
};

const stopCase: EvalCase = {
  name: "stop detection (clustered dwell, min-dwell gate)",
  run: async (): Promise<CheckResult[]> => {
    // Five co-located fixes over 120 s (a dwell) then two 0.001° steps away (movement).
    const fixes: Fix[] = [
      { lng: 0, lat: 0, ts: at(0) },
      { lng: 0, lat: 0, ts: at(30) },
      { lng: 0, lat: 0, ts: at(60) },
      { lng: 0, lat: 0, ts: at(90) },
      { lng: 0, lat: 0, ts: at(120) },
      { lng: 0.001, lat: 0, ts: at(150) },
      { lng: 0.002, lat: 0, ts: at(180) },
    ];
    const stops = detectStops(fixes, { radiusM: 25, minDwellS: 120 });
    const { metrics } = computeTrackMetrics(fixes, { radiusM: 25, minDwellS: 120 });
    // A 60 s dwell must NOT register (below the 120 s gate).
    const shortDwell = detectStops(
      [
        { lng: 0, lat: 0, ts: at(0) },
        { lng: 0, lat: 0, ts: at(30) },
        { lng: 0, lat: 0, ts: at(60) },
        { lng: 0.001, lat: 0, ts: at(90) },
      ],
      { radiusM: 25, minDwellS: 120 },
    );
    return [
      { metric: "stop_detected", pass: stops.length === 1, score: stops.length },
      { metric: "stopped_time_s", pass: approx(metrics.stoppedTimeS, 120, 1e-6), score: metrics.stoppedTimeS },
      { metric: "leg_after_stop", pass: metrics.legCount === 1, score: metrics.legCount },
      { metric: "min_dwell_gate", pass: shortDwell.length === 0, note: "60 s dwell correctly ignored" },
    ];
  },
};

const parseCase: EvalCase = {
  name: "GPX parse → metrics roundtrip",
  run: async (): Promise<CheckResult[]> => {
    const gpx = `<?xml version="1.0"?><gpx><trk><name>Test</name><trkseg>
      <trkpt lat="0" lon="0"><ele>10</ele><time>2026-01-01T00:00:00Z</time></trkpt>
      <trkpt lat="0" lon="0.001"><ele>20</ele><time>2026-01-01T00:01:40Z</time></trkpt>
    </trkseg></trk></gpx>`;
    const parsed = parseGpx(gpx);
    const { metrics } = computeTrackMetrics(parsed.points);
    return [
      { metric: "parsed_points", pass: parsed.points.length === 2, score: parsed.points.length },
      { metric: "parsed_name", pass: parsed.name === "Test", note: parsed.name },
      { metric: "parsed_distance_m", pass: approx(metrics.distanceM, STEP_M, 0.5), score: Math.round(metrics.distanceM) },
      { metric: "parsed_ascent_m", pass: approx(metrics.elevationGainM, 10, 1e-6), score: metrics.elevationGainM },
    ];
  },
};

export const tracksMetrics: Suite = {
  module: "tracks",
  name: "metrics",
  cases: [distanceCase, elevationCase, stopCase, parseCase],
};
