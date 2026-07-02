import type { Sql } from "postgres";
import type { TrackMetrics } from "@/db/schema";
import { computeTrackMetrics, type Fix } from "./metrics";

/**
 * Pass timestamps to postgres as ISO strings (cast `::timestamptz`) rather than Date objects.
 * When this module is bundled alongside the Auth.js instance (the write routes import both), the
 * `postgres` driver can end up duplicated, breaking its `instanceof Date` serialization. Plain
 * strings sidestep that entirely.
 *
 * JSON goes in via `sql.json(...)`, NOT `JSON.stringify(...)::jsonb`: with `prepare:false` (Supabase
 * pooler) the latter is sent as a jsonb *string* (double-encoded), so `jsonb_array_elements` on it
 * throws "cannot extract elements from a scalar". `sql.json` encodes a real jsonb array/object.
 */
const iso = (d: Date | string | number) => new Date(d).toISOString();

export type TrackInput = {
  name: string;
  description?: string | null;
  activity?: string | null;
  source: "gpx" | "geojson" | "synthetic";
  siteId?: string | null;
  userId?: string | null;
  points: Fix[];
};

export type StoredTrack = {
  id: string;
  metrics: TrackMetrics;
  segmentCount: number;
};

/**
 * Persist a track end-to-end in one transaction: compute the grounded metrics + segmentation, write
 * `tracks`, bulk-insert `track_points` (geography), derive a simplified `path` LineString in PostGIS,
 * and write the move/stop `segments`. Shared by `npm run seed:tracks` and the import API so both
 * produce identical, query-ready data. `sql` is a postgres.js client (or a getClient() handle).
 */
export async function insertTrack(sql: Sql, input: TrackInput): Promise<StoredTrack> {
  const fixes = input.points;
  if (fixes.length < 2) throw new Error("A track needs at least two points.");
  // 3 m hysteresis threshold suppresses GPS vertical jitter — standard for fitness-device elevation.
  const { metrics, segments } = computeTrackMetrics(fixes, { elevDeadbandM: 3 });

  const startedAt = fixes[0].ts;
  const endedAt = fixes[fixes.length - 1].ts;

  return sql.begin(async (tx) => {
    const [track] = await tx<{ id: string }[]>`
      INSERT INTO tracks (name, description, activity, source, site_id, user_id, started_at, ended_at, metrics)
      VALUES (
        ${input.name}, ${input.description ?? null}, ${input.activity ?? null}, ${input.source},
        ${input.siteId ?? null}, ${input.userId ?? null}, ${iso(startedAt)}::timestamptz, ${iso(endedAt)}::timestamptz, ${sql.json(metrics as never)}
      )
      RETURNING id
    `;
    const trackId = track.id;

    // Bulk-insert the fixes in one round-trip via a JSON roundtrip (robust element typing).
    const rows = fixes.map((f, i) => ({
      seq: i,
      ts: f.ts.toISOString(),
      lng: f.lng,
      lat: f.lat,
      ele: f.elevation ?? null,
      speed: f.speed ?? null,
    }));
    await tx`
      INSERT INTO track_points (track_id, seq, ts, geom, elevation, speed)
      SELECT ${trackId}, (r->>'seq')::int, (r->>'ts')::timestamptz,
             ST_SetSRID(ST_MakePoint((r->>'lng')::float8, (r->>'lat')::float8), 4326)::geography,
             (r->>'ele')::float8, (r->>'speed')::float8
      FROM jsonb_array_elements(${sql.json(rows)}) AS r
    `;

    // Simplified path for rendering (Douglas–Peucker, ~5 m tolerance in degrees).
    await tx`
      UPDATE tracks SET path = (
        SELECT ST_Simplify(ST_MakeLine(geom::geometry ORDER BY seq), 0.00005)
        FROM track_points WHERE track_id = ${trackId}
      ) WHERE id = ${trackId}
    `;

    // Move/stop segments — geometry from GeoJSON we already shaped in computeTrackMetrics.
    let seg = 0;
    for (const s of segments) {
      const geojson =
        s.kind === "move"
          ? { type: "LineString", coordinates: s.coords }
          : { type: "Point", coordinates: s.coords[0] };
      await tx`
        INSERT INTO segments
          (track_id, kind, seq, start_seq, end_seq, started_at, ended_at, distance_m, duration_s, geom)
        VALUES (
          ${trackId}, ${s.kind}, ${seg}, ${s.startIdx}, ${s.endIdx},
          ${iso(s.startedAt)}::timestamptz, ${iso(s.endedAt)}::timestamptz, ${s.distanceM}, ${s.durationS},
          ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(geojson)}), 4326)
        )
      `;
      seg++;
    }

    return { id: trackId, metrics, segmentCount: segments.length };
  });
}
