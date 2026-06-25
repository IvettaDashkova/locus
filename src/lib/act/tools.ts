import { z } from "zod";
import { tool, type ToolSet } from "ai";
import * as SunCalc from "suncalc";
import { env } from "@/lib/env";

/**
 * The Locus geo tools, written once. Each is a typed function `run(input) => { summary, data,
 * features }` over a free source (Nominatim, Overpass, OpenRouteService, Open-Meteo, SunCalc), with a
 * small in-memory TTL cache. `features` is GeoJSON the map renders directly; `summary`/`data` are
 * what the agent observes. `aiTools()` wraps them as Vercel AI SDK tools; the standalone MCP server
 * (Phase 3.4) reuses the same `run` functions.
 */

const USER_AGENT = "Locus/1.0 (geospatial portfolio demo)";

const cache = new Map<string, { value: unknown; expires: number }>();
async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await fn();
  cache.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

async function fetchJson(url: string, init?: RequestInit): Promise<Record<string, unknown> & { features?: unknown[]; elements?: unknown[] }> {
  const res = await fetch(url, { ...init, headers: { "User-Agent": USER_AGENT, ...init?.headers } });
  if (!res.ok) throw new Error(`${url.split("?")[0]} → HTTP ${res.status}`);
  return res.json();
}

function point(lng: number, lat: number, label: string, kind: string): GeoJSON.Feature {
  return { type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties: { label, kind } };
}

export type ToolRun = { summary: string; data: Record<string, unknown>; features: GeoJSON.Feature[] };

// ── geocode (Nominatim) ──────────────────────────────────────────────────────
const geocodeInput = z.object({ query: z.string().describe("a place name or address") });
async function geocodeRun({ query }: z.infer<typeof geocodeInput>): Promise<ToolRun> {
  const r = (await cached(`geo:${query}`, 86_400_000, () =>
    fetchJson(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=1`),
  )) as unknown as { lat: string; lon: string; display_name: string }[];
  if (!r.length) return { summary: `No match for "${query}".`, data: { found: false }, features: [] };
  const lat = Number(r[0].lat), lng = Number(r[0].lon);
  return {
    summary: `${r[0].display_name} (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    data: { name: r[0].display_name, lat, lng },
    features: [point(lng, lat, r[0].display_name, "geocode")],
  };
}

// ── places_nearby (Overpass) ─────────────────────────────────────────────────
const OSM_TAGS: Record<string, string> = {
  cafe: "amenity=cafe", restaurant: "amenity=restaurant", hotel: "tourism=hotel", hospital: "amenity=hospital",
  park: "leisure=park", school: "amenity=school", pharmacy: "amenity=pharmacy", supermarket: "shop=supermarket",
  atm: "amenity=atm", fuel: "amenity=fuel", museum: "tourism=museum", bank: "amenity=bank",
};
const placesInput = z.object({
  lat: z.number(), lng: z.number(),
  radiusM: z.number().default(1000).describe("search radius in metres"),
  category: z.string().describe("e.g. cafe, hotel, hospital, park, pharmacy"),
});
async function placesRun({ lat, lng, radiusM, category }: z.infer<typeof placesInput>): Promise<ToolRun> {
  const tag = OSM_TAGS[category.toLowerCase()] ?? `amenity=${category.toLowerCase()}`;
  const ql = `[out:json][timeout:25];node(around:${radiusM},${lat},${lng})[${tag}];out 15;`;
  const r = await cached(`places:${tag}:${lat.toFixed(3)}:${lng.toFixed(3)}:${radiusM}`, 3_600_000, () =>
    fetchJson("https://overpass-api.de/api/interpreter", { method: "POST", body: `data=${encodeURIComponent(ql)}` }),
  );
  const els = (r.elements ?? []) as { lat: number; lon: number; tags?: { name?: string } }[];
  const places = els.filter((e) => e.tags?.name).slice(0, 15).map((e) => ({ name: e.tags!.name!, lat: e.lat, lng: e.lon }));
  return {
    summary: `${places.length} ${category} within ${radiusM} m`,
    data: { count: places.length, places },
    features: places.map((p) => point(p.lng, p.lat, p.name, "place")),
  };
}

// ── route (OpenRouteService) ─────────────────────────────────────────────────
const profile = z.enum(["driving-car", "foot-walking", "cycling-regular"]).default("driving-car");
const routeInput = z.object({
  from: z.tuple([z.number(), z.number()]).describe("[lng, lat] start"),
  to: z.tuple([z.number(), z.number()]).describe("[lng, lat] end"),
  profile,
});
async function routeRun({ from, to, profile }: z.infer<typeof routeInput>): Promise<ToolRun> {
  if (!env.ORS_API_KEY) return { summary: "Routing needs ORS_API_KEY.", data: { error: "no_key" }, features: [] };
  const url = `https://api.openrouteservice.org/v2/directions/${profile}?api_key=${env.ORS_API_KEY}&start=${from[0]},${from[1]}&end=${to[0]},${to[1]}`;
  const r = await fetchJson(url);
  const f = (r.features as GeoJSON.Feature[] | undefined)?.[0];
  const summary = (f?.properties as { summary?: { distance: number; duration: number } })?.summary;
  const km = summary ? (summary.distance / 1000).toFixed(1) : "?";
  const min = summary ? Math.round(summary.duration / 60) : 0;
  return {
    summary: `${km} km, ${min} min by ${profile}`,
    data: { distanceM: summary?.distance, durationS: summary?.duration, profile },
    features: f ? [{ ...f, properties: { label: `${km} km · ${min} min`, kind: "route" } }] : [],
  };
}

// ── isochrone (OpenRouteService) ─────────────────────────────────────────────
const isoInput = z.object({
  lng: z.number(), lat: z.number(),
  minutes: z.number().default(15).describe("reachable time in minutes"),
  profile,
});
async function isochroneRun({ lng, lat, minutes, profile }: z.infer<typeof isoInput>): Promise<ToolRun> {
  if (!env.ORS_API_KEY) return { summary: "Isochrones need ORS_API_KEY.", data: { error: "no_key" }, features: [] };
  const r = await fetchJson(`https://api.openrouteservice.org/v2/isochrones/${profile}`, {
    method: "POST",
    headers: { Authorization: env.ORS_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ locations: [[lng, lat]], range: [minutes * 60], range_type: "time" }),
  });
  const feats = ((r.features as GeoJSON.Feature[] | undefined) ?? []).map((f) => ({
    ...f,
    properties: { label: `${minutes} min · ${profile}`, kind: "isochrone" },
  }));
  return { summary: `${minutes}-minute reachable area by ${profile}`, data: { minutes, profile }, features: feats };
}

// ── elevation (Open-Meteo) ───────────────────────────────────────────────────
const latLng = z.object({ lat: z.number(), lng: z.number() });
async function elevationRun({ lat, lng }: z.infer<typeof latLng>): Promise<ToolRun> {
  const r = await cached(`elev:${lat.toFixed(4)}:${lng.toFixed(4)}`, 86_400_000, () =>
    fetchJson(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`),
  );
  const m = (r.elevation as number[] | undefined)?.[0];
  return { summary: m != null ? `Elevation ≈ ${Math.round(m)} m` : "No elevation data.", data: { elevationM: m }, features: [] };
}

// ── weather (Open-Meteo) ─────────────────────────────────────────────────────
async function weatherRun({ lat, lng }: z.infer<typeof latLng>): Promise<ToolRun> {
  const r = await fetchJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m,weather_code`,
  );
  const c = (r.current ?? {}) as { temperature_2m?: number; wind_speed_10m?: number; weather_code?: number };
  return {
    summary: `${c.temperature_2m ?? "?"}°C, wind ${c.wind_speed_10m ?? "?"} km/h`,
    data: { tempC: c.temperature_2m, windKmh: c.wind_speed_10m, weatherCode: c.weather_code },
    features: [],
  };
}

// ── sun_times (SunCalc, local) ───────────────────────────────────────────────
const sunInput = z.object({ lat: z.number(), lng: z.number(), date: z.string().optional().describe("ISO date, defaults to today") });
async function sunRun({ lat, lng, date }: z.infer<typeof sunInput>): Promise<ToolRun> {
  const d = date ? new Date(date) : new Date();
  const t = SunCalc.getTimes(d, lat, lng);
  const hm = (x: Date | null) => (x ? x.toISOString().slice(11, 16) : "—");
  const iso = (x: Date | null) => (x ? x.toISOString() : null);
  return {
    summary: `Sunrise ${hm(t.sunrise)}, sunset ${hm(t.sunset)} (UTC)`,
    data: { sunrise: iso(t.sunrise), sunset: iso(t.sunset), goldenHour: iso(t.goldenHour) },
    features: [],
  };
}

// ── registry + AI SDK adapter ────────────────────────────────────────────────
export const TOOLS = [
  { name: "geocode", description: "Find the coordinates of a place by name or address.", inputSchema: geocodeInput, run: geocodeRun },
  { name: "places_nearby", description: "Find places of a category (cafe, hotel, hospital, park…) near a point.", inputSchema: placesInput, run: placesRun },
  { name: "route", description: "Get a route — distance, duration, path — between two [lng,lat] points.", inputSchema: routeInput, run: routeRun },
  { name: "isochrone", description: "Get the area reachable within N minutes from a point.", inputSchema: isoInput, run: isochroneRun },
  { name: "elevation", description: "Get the ground elevation (metres) at a point.", inputSchema: latLng, run: elevationRun },
  { name: "weather", description: "Get the current weather at a point.", inputSchema: latLng, run: weatherRun },
  { name: "sun_times", description: "Get sunrise, sunset, and golden hour at a point.", inputSchema: sunInput, run: sunRun },
] as const;

/** Wrap the tools as AI SDK tools, collecting GeoJSON features for the map via `collect`. */
export function aiTools(collect: (features: GeoJSON.Feature[]) => void): ToolSet {
  const out: ToolSet = {};
  for (const t of TOOLS) {
    out[t.name] = tool({
      description: t.description,
      inputSchema: t.inputSchema as z.ZodTypeAny,
      execute: async (input: unknown) => {
        const r = await (t.run as (i: unknown) => Promise<ToolRun>)(input);
        if (r.features.length) collect(r.features);
        return { summary: r.summary, ...r.data };
      },
    });
  }
  return out;
}
