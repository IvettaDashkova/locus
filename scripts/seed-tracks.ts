import "./load-env";
import postgres from "postgres";
import { synthesizeTrack, type SynthConfig } from "../src/lib/tracks/synthesize";
import { insertTrack } from "../src/lib/tracks/store";

/**
 * Seeds a handful of physically-plausible synthetic tracks (smooth speed, terrain-like elevation,
 * dwells clustered at endpoints/waypoints) so the Tracks module has realistic data to analyse,
 * play back, and chart — without shipping anyone's real GPS. Deterministic via per-track seeds.
 * Some tracks anchor to an existing site (set by `npm run seed`). Run: `npm run seed:tracks`.
 */
type Recipe = Omit<SynthConfig, "startTime"> & {
  description: string;
  startTime: string;
  /** Anchor to the nearest seeded site whose name contains this (case-insensitive). */
  anchorSiteLike?: string;
};

const RECIPES: Recipe[] = [
  {
    name: "Kyiv old town walk",
    description: "A morning stroll through the historic centre with a coffee stop on the way.",
    activity: "walk",
    seed: 101,
    speedMps: 1.35,
    sampleS: 5,
    startTime: "2026-05-04T07:10:00Z",
    baseElevationM: 175,
    elevationAmpM: 22,
    waypoints: [
      [30.5169, 50.4501], // Maidan
      [30.5186, 50.4536],
      [30.5146, 50.4575], // St. Sophia
      [30.5119, 50.4598],
      [30.5163, 50.4632], // St. Andrew's
    ],
    stops: [
      { atWaypoint: 0, dwellS: 180 },
      { atWaypoint: 2, dwellS: 600 }, // coffee
      { atWaypoint: 4, dwellS: 240 },
    ],
  },
  {
    name: "Ridge trail hike",
    description: "An out-and-back climb to the northern ridge with a summit rest.",
    activity: "hike",
    seed: 202,
    speedMps: 1.05,
    sampleS: 6,
    startTime: "2026-05-09T13:30:00Z",
    baseElevationM: 2600,
    elevationAmpM: 540,
    anchorSiteLike: "ridge",
    waypoints: [
      [-106.8175, 39.1911], // trailhead (matches a seeded site)
      [-106.8221, 39.1968],
      [-106.8264, 39.2032],
      [-106.8295, 39.2098], // ridge / summit
      [-106.8264, 39.2032],
      [-106.8175, 39.1911], // back to trailhead
    ],
    stops: [
      { atWaypoint: 0, dwellS: 300 },
      { atWaypoint: 3, dwellS: 900 }, // summit rest
      { atWaypoint: 5, dwellS: 300 },
    ],
  },
  {
    name: "Riverside cycle loop",
    description: "An afternoon ride along the river path and back through the meadows.",
    activity: "cycle",
    seed: 303,
    speedMps: 5.6,
    sampleS: 4,
    startTime: "2026-05-12T15:00:00Z",
    baseElevationM: 60,
    elevationAmpM: 35,
    waypoints: [
      [13.405, 52.52], // matches Central Depot area, Berlin
      [13.418, 52.515],
      [13.432, 52.508],
      [13.445, 52.516],
      [13.43, 52.524],
      [13.405, 52.52],
    ],
    stops: [
      { atWaypoint: 0, dwellS: 150 },
      { atWaypoint: 3, dwellS: 420 }, // photo / rest
      { atWaypoint: 5, dwellS: 150 },
    ],
  },
  {
    name: "Coastal evening drive",
    description: "A drive down the coast road with a viewpoint stop.",
    activity: "drive",
    seed: 404,
    speedMps: 13.5,
    sampleS: 3,
    startTime: "2026-05-15T17:20:00Z",
    baseElevationM: 30,
    elevationAmpM: 80,
    waypoints: [
      [-122.4194, 37.7749], // matches Harbor Field Office, SF
      [-122.4786, 37.7596],
      [-122.5107, 37.7363],
      [-122.5141, 37.708],
      [-122.4969, 37.6879],
    ],
    stops: [
      { atWaypoint: 0, dwellS: 120 },
      { atWaypoint: 2, dwellS: 360 }, // viewpoint
      { atWaypoint: 4, dwellS: 180 },
    ],
  },
  {
    name: "Harbour survey boat run",
    description: "A monitoring loop around the bay with a sampling stop at the buoy.",
    activity: "boat",
    seed: 505,
    speedMps: 4.2,
    sampleS: 5,
    startTime: "2026-05-18T09:00:00Z",
    baseElevationM: 0,
    elevationAmpM: 1.5,
    anchorSiteLike: "buoy",
    waypoints: [
      [151.2093, -33.8688], // matches Bay Monitoring Buoy, Sydney
      [151.225, -33.86],
      [151.24, -33.855],
      [151.23, -33.845],
      [151.2093, -33.8688],
    ],
    stops: [
      { atWaypoint: 0, dwellS: 200 },
      { atWaypoint: 2, dwellS: 540 }, // sampling
      { atWaypoint: 4, dwellS: 200 },
    ],
  },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (check .env.local)");
  const sql = postgres(url, { max: 1 });
  try {
    await sql`DELETE FROM tracks`; // cascades to track_points + segments

    const sites = await sql<{ id: string; name: string }[]>`SELECT id, name FROM sites`;
    const findSite = (like?: string) =>
      like ? sites.find((s) => s.name.toLowerCase().includes(like.toLowerCase()))?.id ?? null : null;

    for (const r of RECIPES) {
      const { points, activity, source } = synthesizeTrack({
        name: r.name,
        activity: r.activity,
        waypoints: r.waypoints,
        speedMps: r.speedMps,
        sampleS: r.sampleS,
        startTime: new Date(r.startTime),
        baseElevationM: r.baseElevationM,
        elevationAmpM: r.elevationAmpM,
        stops: r.stops,
        seed: r.seed,
      });
      const stored = await insertTrack(sql, {
        name: r.name,
        description: r.description,
        activity,
        source,
        siteId: findSite(r.anchorSiteLike),
        points,
      });
      const m = stored.metrics;
      console.log(
        `✓ ${r.name} — ${(m.distanceM / 1000).toFixed(2)} km, ${m.pointCount} pts, ` +
          `${m.stopCount} stops, ${m.legCount} legs, +${Math.round(m.elevationGainM)} m`,
      );
    }
    const [{ count }] = await sql<{ count: string }[]>`SELECT count(*)::text AS count FROM tracks`;
    console.log(`✓ seeded ${count} tracks`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
