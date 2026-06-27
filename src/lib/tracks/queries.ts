import { getClient } from "@/db/client";
import type { TrackMetrics } from "@/db/schema";

export type TrackSummary = {
  id: string;
  name: string;
  description: string | null;
  activity: string | null;
  source: string;
  startedAt: string | null;
  endedAt: string | null;
  metrics: TrackMetrics | null;
  bbox: [number, number, number, number] | null;
  path: GeoJSON.LineString | null;
};

export type TrackPointRow = {
  seq: number;
  ts: string;
  lng: number;
  lat: number;
  elevation: number | null;
  speed: number | null;
};

export type SegmentFeature = {
  kind: "move" | "stop";
  seq: number;
  startSeq: number;
  endSeq: number;
  startedAt: string;
  endedAt: string;
  distanceM: number | null;
  durationS: number | null;
  geometry: GeoJSON.Geometry;
};

const parseGeo = <T extends GeoJSON.Geometry>(s: string | null): T | null =>
  s ? (JSON.parse(s) as T) : null;

/** All tracks with their computed metrics, bounding box, and simplified path (for the overview map). */
export async function listTracks(): Promise<TrackSummary[]> {
  const sql = getClient();
  const rows = await sql<
    {
      id: string;
      name: string;
      description: string | null;
      activity: string | null;
      source: string;
      started_at: string | null;
      ended_at: string | null;
      metrics: TrackMetrics | null;
      path: string | null;
      xmin: number | null;
      ymin: number | null;
      xmax: number | null;
      ymax: number | null;
    }[]
  >`
    SELECT id, name, description, activity, source, started_at, ended_at, metrics,
           ST_AsGeoJSON(path) AS path,
           ST_XMin(path) AS xmin, ST_YMin(path) AS ymin, ST_XMax(path) AS xmax, ST_YMax(path) AS ymax
    FROM tracks
    ORDER BY started_at DESC NULLS LAST, created_at DESC
  `;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    activity: r.activity,
    source: r.source,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    metrics: r.metrics,
    bbox:
      r.xmin != null && r.ymin != null && r.xmax != null && r.ymax != null
        ? [r.xmin, r.ymin, r.xmax, r.ymax]
        : null,
    path: parseGeo<GeoJSON.LineString>(r.path),
  }));
}

export type TrackDetail = {
  track: TrackSummary;
  points: TrackPointRow[];
  segments: SegmentFeature[];
};

/** One track with its ordered fixes (for playback + charts) and move/stop segments. */
export async function getTrack(id: string): Promise<TrackDetail | null> {
  const sql = getClient();
  const [t] = await sql<
    {
      id: string;
      name: string;
      description: string | null;
      activity: string | null;
      source: string;
      started_at: string | null;
      ended_at: string | null;
      metrics: TrackMetrics | null;
      path: string | null;
      xmin: number | null;
      ymin: number | null;
      xmax: number | null;
      ymax: number | null;
    }[]
  >`
    SELECT id, name, description, activity, source, started_at, ended_at, metrics,
           ST_AsGeoJSON(path) AS path,
           ST_XMin(path) AS xmin, ST_YMin(path) AS ymin, ST_XMax(path) AS xmax, ST_YMax(path) AS ymax
    FROM tracks WHERE id = ${id}
  `;
  if (!t) return null;

  const points = await sql<TrackPointRow[]>`
    SELECT seq, ts, ST_X(geom::geometry) AS lng, ST_Y(geom::geometry) AS lat, elevation, speed
    FROM track_points WHERE track_id = ${id} ORDER BY seq
  `;

  const segRows = await sql<
    {
      kind: "move" | "stop";
      seq: number;
      start_seq: number;
      end_seq: number;
      started_at: string;
      ended_at: string;
      distance_m: number | null;
      duration_s: number | null;
      geometry: string;
    }[]
  >`
    SELECT kind, seq, start_seq, end_seq, started_at, ended_at, distance_m, duration_s,
           ST_AsGeoJSON(geom) AS geometry
    FROM segments WHERE track_id = ${id} ORDER BY seq
  `;

  return {
    track: {
      id: t.id,
      name: t.name,
      description: t.description,
      activity: t.activity,
      source: t.source,
      startedAt: t.started_at,
      endedAt: t.ended_at,
      metrics: t.metrics,
      bbox:
        t.xmin != null && t.ymin != null && t.xmax != null && t.ymax != null
          ? [t.xmin, t.ymin, t.xmax, t.ymax]
          : null,
      path: parseGeo<GeoJSON.LineString>(t.path),
    },
    points,
    segments: segRows.map((s) => ({
      kind: s.kind,
      seq: s.seq,
      startSeq: s.start_seq,
      endSeq: s.end_seq,
      startedAt: s.started_at,
      endedAt: s.ended_at,
      distanceM: s.distance_m,
      durationS: s.duration_s,
      geometry: JSON.parse(s.geometry) as GeoJSON.Geometry,
    })),
  };
}

/** Downsampled union of all track fixes as a point FeatureCollection — feeds the density heatmap. */
export async function trackHeatmap(maxPoints = 4000): Promise<GeoJSON.FeatureCollection> {
  const sql = getClient();
  const [{ total }] = await sql<{ total: number }[]>`SELECT count(*)::int AS total FROM track_points`;
  const stride = Math.max(1, Math.ceil(total / maxPoints));
  const rows = await sql<{ lng: number; lat: number }[]>`
    SELECT ST_X(geom::geometry) AS lng, ST_Y(geom::geometry) AS lat
    FROM (
      SELECT geom, row_number() OVER (ORDER BY track_id, seq) AS rn FROM track_points
    ) q
    WHERE rn % ${stride} = 0
  `;
  return {
    type: "FeatureCollection",
    features: rows.map((r) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [r.lng, r.lat] },
      properties: {},
    })),
  };
}
