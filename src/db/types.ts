import { customType } from "drizzle-orm/pg-core";

/** Minimal GeoJSON shapes used across modules. SRID 4326 (WGS84) everywhere. */
export type GeoJSONPoint = { type: "Point"; coordinates: [number, number] };
export type GeoJSONPolygon = { type: "Polygon"; coordinates: [number, number][][] };
export type GeoJSONGeometry = GeoJSONPoint | GeoJSONPolygon;

/**
 * PostGIS `geometry(Point, 4326)`. We read/write GeoJSON at the query boundary via
 * ST_AsGeoJSON / ST_GeomFromGeoJSON (or ST_MakePoint for inserts), so the in-DB representation
 * stays native. The TS-side value is the GeoJSON string; queries that need structured access
 * select `ST_AsGeoJSON(geom)` explicitly.
 */
export const geometry = customType<{ data: string; driverData: string }>({
  dataType() {
    return "geometry(Point, 4326)";
  },
});

/**
 * PostGIS `geography(Point, 4326)`. Geography (not geometry) so PostGIS measures distance on the
 * spheroid in metres — what Tracks needs for trajectory metrics. Same GeoJSON-at-the-boundary
 * convention as `geometry`. Used by `track_points` (Phase 4).
 */
export const geographyPoint = customType<{ data: string; driverData: string }>({
  dataType() {
    return "geography(Point, 4326)";
  },
});

/** PostGIS `geometry(LineString, 4326)` — a simplified track path, rendered as one line. */
export const lineString = customType<{ data: string; driverData: string }>({
  dataType() {
    return "geometry(LineString, 4326)";
  },
});

/** PostGIS `geometry(Geometry, 4326)` — a segment may be a LineString (a move leg) or a Point (a stop). */
export const geometryAny = customType<{ data: string; driverData: string }>({
  dataType() {
    return "geometry(Geometry, 4326)";
  },
});

/**
 * pgvector `vector(N)`. Dimension is pinned by the embedding model (see lib/ai/embeddings.config).
 * Used from Phase 2 onward; defined here so the type is shared.
 */
export const vector = (dimensions: number) =>
  customType<{ data: number[]; driverData: string }>({
    dataType() {
      return `vector(${dimensions})`;
    },
    toDriver(value: number[]) {
      return `[${value.join(",")}]`;
    },
    fromDriver(value: string) {
      return value.slice(1, -1).split(",").map(Number);
    },
  });
