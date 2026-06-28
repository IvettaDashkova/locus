import searouteImport from "searoute-js";

// searoute-js is a CommonJS `module.exports = function`. Depending on the bundler/interop, the
// default import can arrive as the function or wrapped as `{ default: fn }` — normalize both.
type SeaRouteFn = (
  origin: GeoJSON.Feature<GeoJSON.Point>,
  destination: GeoJSON.Feature<GeoJSON.Point>,
  units?: string,
) => GeoJSON.Feature<GeoJSON.LineString> | null;
const searoute: SeaRouteFn =
  typeof searouteImport === "function"
    ? (searouteImport as SeaRouteFn)
    : ((searouteImport as unknown as { default: SeaRouteFn }).default);

type LngLat = [number, number];

const feature = (p: LngLat): GeoJSON.Feature<GeoJSON.Point> => ({
  type: "Feature",
  properties: {},
  geometry: { type: "Point", coordinates: p },
});

/** searoute-js logs node indices to stdout; silence it for the duration of a call. */
function silent<T>(fn: () => T): T {
  const log = console.log;
  console.log = () => {};
  try {
    return fn();
  } finally {
    console.log = log;
  }
}

const same = (a: LngLat, b: LngLat) => a[0] === b[0] && a[1] === b[1];

/**
 * Shortest maritime path between two points, snapped to the global sea-lane network (Eurostat
 * searoute) so it stays on water and goes *around* land. Returns the routed polyline, or a straight
 * fallback when the two points are too close to route (they snap to the same network node) — fine,
 * since a short hop between nearby water points doesn't need routing.
 */
export function seaRouteSegment(a: LngLat, b: LngLat): LngLat[] {
  try {
    const r = silent(() => searoute(feature(a), feature(b), "kilometers"));
    const coords = r?.geometry?.coordinates as LngLat[] | undefined;
    if (coords && coords.length >= 2) return coords;
  } catch {
    /* degenerate (points snap to one node) — fall back to a straight hop */
  }
  return [a, b];
}

/**
 * Route a sequence of waypoints by sea: each consecutive pair is routed on the marine network and
 * the segments are concatenated (shared joints de-duplicated). The user's clicks act as via-points;
 * the saved path follows the water between them. Used for boat/ship routes in the route builder.
 */
export function seaRoute(waypoints: LngLat[]): LngLat[] {
  if (waypoints.length < 2) return waypoints;
  const out: LngLat[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const seg = seaRouteSegment(waypoints[i], waypoints[i + 1]);
    for (const c of seg) {
      const last = out[out.length - 1];
      if (!last || !same(last, c)) out.push(c);
    }
  }
  return out.length >= 2 ? out : waypoints;
}
