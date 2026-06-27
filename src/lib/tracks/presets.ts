import type { SynthConfig } from "./synthesize";

export type Activity = "walk" | "hike" | "run" | "cycle" | "drive" | "boat";

export const ACTIVITIES: Activity[] = ["walk", "hike", "run", "cycle", "drive", "boat"];

/** Plausible cruise speed + sampling cadence per activity, used to turn a drawn route into a track. */
export const ACTIVITY_PRESETS: Record<Activity, { speedMps: number; sampleS: number }> = {
  walk: { speedMps: 1.35, sampleS: 5 },
  hike: { speedMps: 1.1, sampleS: 6 },
  run: { speedMps: 3.0, sampleS: 4 },
  cycle: { speedMps: 5.5, sampleS: 4 },
  drive: { speedMps: 13.0, sampleS: 3 },
  boat: { speedMps: 4.0, sampleS: 5 },
};

export function isActivity(v: unknown): v is Activity {
  return typeof v === "string" && (ACTIVITIES as string[]).includes(v);
}

/**
 * Build a synth config from a hand-drawn route. We synthesize plausible timing/speed from the
 * activity preset but deliberately leave elevation OUT (`elevation: false`) — we don't know the real
 * terrain of a drawn line, so the honest thing is no elevation data rather than invented terrain.
 * Short dwells are added at the first and last waypoints so the trip has start/end stops.
 */
export function routeToSynthConfig(
  name: string,
  activity: Activity,
  waypoints: [number, number][],
  startTime: Date,
): SynthConfig {
  const preset = ACTIVITY_PRESETS[activity];
  return {
    name,
    activity,
    waypoints,
    speedMps: preset.speedMps,
    sampleS: preset.sampleS,
    startTime,
    baseElevationM: 0,
    elevationAmpM: 0,
    elevation: false,
    maxPoints: 1500, // keep drawn routes bounded regardless of length/zoom
    stops: [
      { atWaypoint: 0, dwellS: 120 },
      { atWaypoint: waypoints.length - 1, dwellS: 120 },
    ],
    seed: Math.floor(waypoints[0][0] * 1000 + waypoints[0][1] * 1000) || 1,
  };
}
