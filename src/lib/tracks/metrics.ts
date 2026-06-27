import type { TrackMetrics } from "@/db/schema";
import { haversineM, centroid } from "./geo";

/** One GPS fix, the unit the metrics service consumes. `ts` is the fix time. */
export type Fix = {
  lng: number;
  lat: number;
  ts: Date;
  elevation?: number | null;
  /** Device-reported instantaneous speed in m/s, if any; otherwise derived from positions. */
  speed?: number | null;
};

/** A track split into alternating travelled legs and dwells. Indices reference the input `fixes`. */
export type SegmentSpan = {
  kind: "move" | "stop";
  startIdx: number;
  endIdx: number;
  startedAt: Date;
  endedAt: Date;
  distanceM: number;
  durationS: number;
  /** Polyline for a move leg; single centroid for a stop. */
  coords: [number, number][];
};

export type TrackAnalysis = {
  metrics: TrackMetrics;
  segments: SegmentSpan[];
};

export type StopOptions = {
  /** A dwell is a run of fixes staying within this radius (metres) of its anchor. */
  radiusM?: number;
  /** …for at least this long (seconds). Temporal gate — NOT a speed threshold. */
  minDwellS?: number;
};

/** Per-point series for charts: cumulative distance, speed, and elevation aligned to `fixes`. */
export type TrackProfile = {
  cumulativeM: number[];
  speedMps: number[];
  elevationM: (number | null)[];
};

const secondsBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 1000;

/**
 * Stay-point detection (Li et al. 2008): a *stop* is a maximal run of consecutive fixes that all
 * fall within `radiusM` of the run's first fix AND span at least `minDwellS` of time. This is a
 * spatial+temporal clustering with a minimum-dwell gate — deliberately not a speed cutoff, so a
 * slow crawl through traffic isn't mistaken for a stop and a brief pause at a light isn't either.
 */
export function detectStops(
  fixes: Fix[],
  { radiusM = 25, minDwellS = 120 }: StopOptions = {},
): { startIdx: number; endIdx: number }[] {
  const stops: { startIdx: number; endIdx: number }[] = [];
  const n = fixes.length;
  let i = 0;
  while (i < n - 1) {
    const anchor: [number, number] = [fixes[i].lng, fixes[i].lat];
    let j = i + 1;
    while (j < n && haversineM(anchor, [fixes[j].lng, fixes[j].lat]) <= radiusM) j++;
    // fixes[i..j-1] are all within radiusM of the anchor.
    const last = j - 1;
    if (last > i && secondsBetween(fixes[i].ts, fixes[last].ts) >= minDwellS) {
      stops.push({ startIdx: i, endIdx: last });
      i = j; // resume after the dwell
    } else {
      i++;
    }
  }
  return stops;
}

function legDistance(fixes: Fix[], from: number, to: number): number {
  let d = 0;
  for (let k = from; k < to; k++) {
    d += haversineM([fixes[k].lng, fixes[k].lat], [fixes[k + 1].lng, fixes[k + 1].lat]);
  }
  return d;
}

/** Split a track into ordered move/stop segments from the detected dwells. */
function buildSegments(fixes: Fix[], stops: { startIdx: number; endIdx: number }[]): SegmentSpan[] {
  const segments: SegmentSpan[] = [];
  let cursor = 0;
  const pushMove = (from: number, to: number) => {
    if (to <= from) return; // a move needs at least two fixes
    segments.push({
      kind: "move",
      startIdx: from,
      endIdx: to,
      startedAt: fixes[from].ts,
      endedAt: fixes[to].ts,
      distanceM: legDistance(fixes, from, to),
      durationS: secondsBetween(fixes[from].ts, fixes[to].ts),
      coords: fixes.slice(from, to + 1).map((f) => [f.lng, f.lat] as [number, number]),
    });
  };
  for (const s of stops) {
    pushMove(cursor, s.startIdx);
    const pts = fixes.slice(s.startIdx, s.endIdx + 1).map((f) => [f.lng, f.lat] as [number, number]);
    segments.push({
      kind: "stop",
      startIdx: s.startIdx,
      endIdx: s.endIdx,
      startedAt: fixes[s.startIdx].ts,
      endedAt: fixes[s.endIdx].ts,
      distanceM: 0,
      durationS: secondsBetween(fixes[s.startIdx].ts, fixes[s.endIdx].ts),
      coords: [centroid(pts)],
    });
    cursor = s.endIdx;
  }
  pushMove(cursor, fixes.length - 1);
  return segments;
}

/**
 * Compute grounded metrics + segmentation for an ordered track. `elevDeadbandM` ignores
 * sub-threshold up/down wiggle when summing elevation gain/loss (0 = exact, for tests; a few metres
 * for noisy real GPS). Every number here is a measured fact — the "explain this trip" LLM is handed
 * these and forbidden from computing its own.
 */
export function computeTrackMetrics(
  fixes: Fix[],
  opts: StopOptions & { elevDeadbandM?: number } = {},
): TrackAnalysis {
  const n = fixes.length;
  const empty: TrackMetrics = {
    pointCount: n,
    distanceM: 0,
    movingDistanceM: 0,
    durationS: 0,
    movingTimeS: 0,
    stoppedTimeS: 0,
    avgSpeedMps: 0,
    maxSpeedMps: 0,
    elevationGainM: 0,
    elevationLossM: 0,
    minElevationM: null,
    maxElevationM: null,
    stopCount: 0,
    legCount: 0,
  };
  if (n < 2) return { metrics: empty, segments: [] };

  const stops = detectStops(fixes, opts);
  const segments = buildSegments(fixes, stops);

  const distanceM = legDistance(fixes, 0, n - 1);
  const durationS = secondsBetween(fixes[0].ts, fixes[n - 1].ts);

  const stoppedTimeS = segments
    .filter((s) => s.kind === "stop")
    .reduce((a, s) => a + s.durationS, 0);
  const moveLegs = segments.filter((s) => s.kind === "move");
  const movingDistanceM = moveLegs.reduce((a, s) => a + s.distanceM, 0);
  const movingTimeS = Math.max(0, durationS - stoppedTimeS);

  // Max instantaneous speed: prefer device speed, else derive from consecutive positions.
  let maxSpeedMps = 0;
  for (let k = 0; k < n; k++) {
    let v = fixes[k].speed ?? null;
    if (v == null && k > 0) {
      const dt = secondsBetween(fixes[k - 1].ts, fixes[k].ts);
      if (dt > 0) v = haversineM([fixes[k - 1].lng, fixes[k - 1].lat], [fixes[k].lng, fixes[k].lat]) / dt;
    }
    if (v != null && v > maxSpeedMps) maxSpeedMps = v;
  }

  // Elevation gain/loss with an optional deadband to suppress GPS jitter.
  const deadband = opts.elevDeadbandM ?? 0;
  let gain = 0;
  let loss = 0;
  let minEl: number | null = null;
  let maxEl: number | null = null;
  let prevEl: number | null = null;
  for (const f of fixes) {
    const e = f.elevation ?? null;
    if (e == null) continue;
    minEl = minEl == null ? e : Math.min(minEl, e);
    maxEl = maxEl == null ? e : Math.max(maxEl, e);
    if (prevEl != null) {
      const d = e - prevEl;
      if (d > deadband) gain += d;
      else if (d < -deadband) loss += -d;
    }
    prevEl = e;
  }

  const metrics: TrackMetrics = {
    pointCount: n,
    distanceM,
    movingDistanceM,
    durationS,
    movingTimeS,
    stoppedTimeS,
    avgSpeedMps: movingTimeS > 0 ? movingDistanceM / movingTimeS : 0,
    maxSpeedMps,
    elevationGainM: gain,
    elevationLossM: loss,
    minElevationM: minEl,
    maxElevationM: maxEl,
    stopCount: stops.length,
    legCount: moveLegs.length,
  };
  return { metrics, segments };
}

/** Build aligned per-point series for the speed/elevation/pace charts. */
export function trackProfile(fixes: Fix[]): TrackProfile {
  const cumulativeM: number[] = [];
  const speedMps: number[] = [];
  const elevationM: (number | null)[] = [];
  let cum = 0;
  for (let k = 0; k < fixes.length; k++) {
    if (k > 0) {
      cum += haversineM([fixes[k - 1].lng, fixes[k - 1].lat], [fixes[k].lng, fixes[k].lat]);
    }
    cumulativeM.push(cum);
    let v = fixes[k].speed ?? null;
    if (v == null && k > 0) {
      const dt = secondsBetween(fixes[k - 1].ts, fixes[k].ts);
      v = dt > 0 ? haversineM([fixes[k - 1].lng, fixes[k - 1].lat], [fixes[k].lng, fixes[k].lat]) / dt : 0;
    }
    speedMps.push(v ?? 0);
    elevationM.push(fixes[k].elevation ?? null);
  }
  return { cumulativeM, speedMps, elevationM };
}
