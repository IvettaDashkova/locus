import type { Fix } from "./metrics";

/**
 * Physically-plausible synthetic track generator. Used by `npm run seed:tracks` so the demo has
 * realistic trajectories without shipping anyone's real GPS data. Properties that matter for the
 * analytics to look real: smooth (not constant) speed, terrain-like elevation, and dwells clustered
 * at endpoints/stops that stay-point detection will actually catch. Deterministic given `seed`.
 */
export type SynthStop = { atWaypoint: number; dwellS: number };

export type SynthConfig = {
  name: string;
  activity: "walk" | "hike" | "run" | "cycle" | "drive" | "boat";
  waypoints: [number, number][];
  /** Cruise speed in m/s (e.g. walk ~1.3, cycle ~5.5, drive ~14). */
  speedMps: number;
  /** Seconds between fixes (sampling cadence). */
  sampleS: number;
  startTime: Date;
  baseElevationM: number;
  /** Peak-to-trough terrain relief over the route. */
  elevationAmpM: number;
  stops?: SynthStop[];
  seed: number;
};

export type SynthTrack = {
  name: string;
  activity: SynthConfig["activity"];
  source: "synthetic";
  points: Fix[];
};

/** Small, fast seeded PRNG (mulberry32) so seeded tracks are byte-reproducible across runs. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function haversineM(a: [number, number], b: [number, number]): number {
  const R = 6_371_008.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function synthesizeTrack(cfg: SynthConfig): SynthTrack {
  const rng = mulberry32(cfg.seed);
  const stopsAt = new Map((cfg.stops ?? []).map((s) => [s.atWaypoint, s.dwellS]));
  const points: Fix[] = [];
  let t = cfg.startTime.getTime();

  // Total route length, so elevation can follow a terrain profile over [0..1] progress.
  let totalM = 0;
  for (let i = 0; i < cfg.waypoints.length - 1; i++) {
    totalM += haversineM(cfg.waypoints[i], cfg.waypoints[i + 1]);
  }
  let travelled = 0;

  const elevationAt = (progress: number, jitter: number) =>
    cfg.baseElevationM +
    cfg.elevationAmpM * (0.6 * Math.sin(progress * Math.PI * 2) + 0.4 * Math.sin(progress * Math.PI * 0.5)) +
    jitter;

  const pushFix = (lng: number, lat: number) => {
    const progress = totalM > 0 ? travelled / totalM : 0;
    points.push({
      lng,
      lat,
      ts: new Date(t),
      elevation: Math.round(elevationAt(progress, (rng() - 0.5) * 2) * 10) / 10,
    });
    t += cfg.sampleS * 1000;
  };

  const dwell = (lng: number, lat: number, dwellS: number) => {
    const n = Math.max(1, Math.round(dwellS / cfg.sampleS));
    for (let k = 0; k < n; k++) {
      // tiny GPS jitter (~<8 m) so a stop is a real cluster, not a duplicated point.
      pushFix(lng + (rng() - 0.5) * 0.00012, lat + (rng() - 0.5) * 0.00012);
    }
  };

  // Dwell at the start, if requested.
  if (stopsAt.has(0)) dwell(cfg.waypoints[0][0], cfg.waypoints[0][1], stopsAt.get(0)!);

  for (let i = 0; i < cfg.waypoints.length - 1; i++) {
    const a = cfg.waypoints[i];
    const b = cfg.waypoints[i + 1];
    const legM = haversineM(a, b);
    const steps = Math.max(1, Math.round(legM / (cfg.speedMps * cfg.sampleS)));

    // Smoothly varying speed → uneven step fractions that still sum to 1.
    const weights: number[] = [];
    let wSum = 0;
    for (let k = 1; k <= steps; k++) {
      const w = 1 + 0.3 * Math.sin((k / steps) * Math.PI * 2) + 0.12 * (rng() - 0.5);
      const ww = Math.max(0.2, w);
      weights.push(ww);
      wSum += ww;
    }
    let acc = 0;
    for (let k = 0; k < steps; k++) {
      acc += weights[k];
      const frac = acc / wSum;
      pushFix(lerp(a[0], b[0], frac), lerp(a[1], b[1], frac));
      travelled += (weights[k] / wSum) * legM;
    }

    // Dwell at this intermediate/final waypoint, if requested.
    if (stopsAt.has(i + 1)) dwell(b[0], b[1], stopsAt.get(i + 1)!);
  }

  return { name: cfg.name, activity: cfg.activity, source: "synthetic", points };
}
