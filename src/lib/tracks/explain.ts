import type { TrackMetrics } from "@/db/schema";
import type { SegmentFeature, TrackSummary } from "./queries";

export const EXPLAIN_SYSTEM = [
  "You are Locus Tracks, writing a short plain-language briefing about a GPS trajectory.",
  "You are given COMPUTED, authoritative facts about the trip. Use ONLY those numbers.",
  "Never compute, estimate, round differently, or invent any figure, place, or time not given.",
  "Write 3–5 sentences: what kind of outing it looks like, the effort (distance, time, climb),",
  "the pace, and the stops. Be concrete and natural — not a bullet list. Answer in the user's language.",
].join(" ");

const fmtDuration = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
};
const km = (m: number) => (m / 1000).toFixed(2);
const kmh = (mps: number) => (mps * 3.6).toFixed(1);

/** Render the computed metrics + stops as a grounded facts block the model must not deviate from. */
export function tripFacts(
  track: Pick<TrackSummary, "name" | "activity">,
  metrics: TrackMetrics,
  segments: SegmentFeature[],
): string {
  const stops = segments.filter((s) => s.kind === "stop");
  const lines = [
    `Name: ${track.name}`,
    track.activity ? `Activity hint: ${track.activity}` : null,
    `Total distance: ${km(metrics.distanceM)} km`,
    `Total elapsed time: ${fmtDuration(metrics.durationS)}`,
    `Moving time: ${fmtDuration(metrics.movingTimeS)}`,
    `Stopped time: ${fmtDuration(metrics.stoppedTimeS)}`,
    `Average moving speed: ${kmh(metrics.avgSpeedMps)} km/h`,
    `Max speed: ${kmh(metrics.maxSpeedMps)} km/h`,
    `Elevation gain: ${Math.round(metrics.elevationGainM)} m`,
    `Elevation loss: ${Math.round(metrics.elevationLossM)} m`,
    metrics.maxElevationM != null
      ? `Elevation range: ${Math.round(metrics.minElevationM ?? 0)}–${Math.round(metrics.maxElevationM)} m`
      : null,
    `Number of stops: ${metrics.stopCount}`,
    `Number of travel legs: ${metrics.legCount}`,
  ].filter(Boolean);

  if (stops.length) {
    const durs = stops
      .map((s) => (s.durationS != null ? fmtDuration(s.durationS) : "?"))
      .join(", ");
    lines.push(`Stop durations: ${durs}`);
  }
  return lines.join("\n");
}
