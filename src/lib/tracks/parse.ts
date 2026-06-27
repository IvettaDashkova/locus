import type { Fix } from "./metrics";

/** A track ready to persist: a name plus ordered fixes. */
export type ParsedTrack = {
  name: string;
  source: "gpx" | "geojson";
  points: Fix[];
};

/** When a format carries no timestamps, fixes are spaced this far apart so metrics still work. */
const SYNTHETIC_STEP_S = 1;

function synthesizeTimes(points: Omit<Fix, "ts">[], baseMs = 0): Fix[] {
  return points.map((p, i) => ({ ...p, ts: new Date(baseMs + i * SYNTHETIC_STEP_S * 1000) }));
}

const num = (s: string | undefined | null) => {
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
};

/**
 * Minimal GPX track parser — pulls `<trkpt lat lon>` with optional `<ele>` and `<time>`. GPX is a
 * flat, well-formed subset of XML for tracks; a focused regex reader keeps us dependency-free
 * (no XML lib) and is enough for the GPX exported by Strava/Garmin/phones.
 */
export function parseGpx(xml: string): ParsedTrack {
  const nameMatch = xml.match(/<name>([^<]*)<\/name>/i);
  const name = nameMatch?.[1]?.trim() || "Imported GPX track";

  const points: { lng: number; lat: number; elevation: number | null; ts: Date | null }[] = [];
  const trkptRe = /<trkpt\b[^>]*\blat=["']([^"']+)["'][^>]*\blon=["']([^"']+)["'][^>]*>([\s\S]*?)<\/trkpt>|<trkpt\b[^>]*\blat=["']([^"']+)["'][^>]*\blon=["']([^"']+)["'][^>]*\/>/gi;
  let m: RegExpExecArray | null;
  while ((m = trkptRe.exec(xml))) {
    const lat = num(m[1] ?? m[4]);
    const lng = num(m[2] ?? m[5]);
    if (lat == null || lng == null) continue;
    const inner = m[3] ?? "";
    const ele = num(inner.match(/<ele>([^<]*)<\/ele>/i)?.[1]);
    const time = inner.match(/<time>([^<]*)<\/time>/i)?.[1];
    const ts = time ? new Date(time) : null;
    points.push({ lng, lat, elevation: ele, ts: ts && !Number.isNaN(ts.getTime()) ? ts : null });
  }
  if (!points.length) throw new Error("No <trkpt> points found in GPX.");

  const hasTimes = points.every((p) => p.ts != null);
  const fixes: Fix[] = hasTimes
    ? points.map((p) => ({ lng: p.lng, lat: p.lat, elevation: p.elevation, ts: p.ts as Date }))
    : synthesizeTimes(points.map((p) => ({ lng: p.lng, lat: p.lat, elevation: p.elevation })));
  return { name, source: "gpx", points: fixes };
}

type GeoJSONish = {
  type?: string;
  features?: { type?: string; geometry?: unknown; properties?: Record<string, unknown> }[];
  geometry?: unknown;
  properties?: Record<string, unknown>;
  coordinates?: unknown;
};

function coordsFromGeometry(geom: unknown): [number, number, number?][] {
  const g = geom as { type?: string; coordinates?: unknown } | null;
  if (!g || typeof g !== "object") return [];
  if (g.type === "LineString" && Array.isArray(g.coordinates)) {
    return g.coordinates as [number, number, number?][];
  }
  if (g.type === "MultiLineString" && Array.isArray(g.coordinates)) {
    return (g.coordinates as [number, number, number?][][]).flat();
  }
  return [];
}

/**
 * GeoJSON track parser — accepts a LineString/MultiLineString geometry, Feature, or FeatureCollection
 * (first line feature). Per-point timestamps are read from the de-facto `coordinateProperties.times`
 * (what toGeoJSON/Strava emit); elevation from the optional 3rd coordinate. Falls back to synthetic
 * 1 Hz timing when no times are present.
 */
export function parseGeoJson(input: unknown): ParsedTrack {
  const root = input as GeoJSONish;
  let geometry: unknown = null;
  let properties: Record<string, unknown> = {};
  let name = "Imported GeoJSON track";

  if (root.type === "FeatureCollection" && root.features?.length) {
    const feat = root.features.find((f) => coordsFromGeometry(f.geometry).length) ?? root.features[0];
    geometry = feat.geometry;
    properties = feat.properties ?? {};
  } else if (root.type === "Feature") {
    geometry = root.geometry;
    properties = root.properties ?? {};
  } else {
    geometry = root; // a bare geometry
  }
  if (typeof properties.name === "string" && properties.name.trim()) name = properties.name.trim();

  const coords = coordsFromGeometry(geometry);
  if (!coords.length) throw new Error("No LineString coordinates found in GeoJSON.");

  const cp = (properties.coordinateProperties ?? {}) as Record<string, unknown>;
  const times = (cp.times ?? properties.times) as unknown;
  const timeArr = Array.isArray(times) ? times : null;

  const base = coords.map((c, i) => {
    const lng = num(String(c[0]));
    const lat = num(String(c[1]));
    const elevation = c[2] != null ? num(String(c[2])) : null;
    const t = timeArr?.[i];
    const ts = t != null ? new Date(t as string | number) : null;
    return { lng: lng ?? 0, lat: lat ?? 0, elevation, ts: ts && !Number.isNaN(ts.getTime()) ? ts : null };
  });

  const hasTimes = base.every((p) => p.ts != null);
  const points: Fix[] = hasTimes
    ? base.map((p) => ({ lng: p.lng, lat: p.lat, elevation: p.elevation, ts: p.ts as Date }))
    : synthesizeTimes(base.map((p) => ({ lng: p.lng, lat: p.lat, elevation: p.elevation })));
  return { name, source: "geojson", points };
}

/** Sniff GPX vs GeoJSON from the raw upload and parse accordingly. */
export function parseTrack(content: string, filename?: string): ParsedTrack {
  const trimmed = content.trimStart();
  const looksXml = trimmed.startsWith("<") || /\.gpx$/i.test(filename ?? "");
  if (looksXml) return parseGpx(content);
  return parseGeoJson(JSON.parse(content));
}
