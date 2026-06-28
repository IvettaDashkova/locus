import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USER_AGENT = "Locus/1.0 (geospatial portfolio demo)";

export type GeocodeResult = { label: string; lng: number; lat: number };

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    osm_value?: string;
  };
};

function labelOf(f: PhotonFeature): string {
  const p = f.properties ?? {};
  const parts = [p.name ?? p.street, p.city, p.state, p.country].filter(Boolean);
  return parts.join(", ") || (p.name ?? "Unknown place");
}

/**
 * GET /api/geocode?q=… → place suggestions for the route-builder typeahead. Uses Photon
 * (komoot, OSM-based) which is built for autocomplete and free with no key. Proxied server-side so
 * we can set a User-Agent and avoid CORS. Returns [] for short/empty queries.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });
  try {
    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6`, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) throw new Error(`Photon HTTP ${res.status}`);
    const json = (await res.json()) as { features?: PhotonFeature[] };
    const results: GeocodeResult[] = (json.features ?? [])
      .filter((f) => Array.isArray(f.geometry?.coordinates))
      .map((f) => ({
        label: labelOf(f),
        lng: f.geometry!.coordinates![0],
        lat: f.geometry!.coordinates![1],
      }));
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json(
      { results: [], error: e instanceof Error ? e.message : String(e) },
      { status: 200 }, // typeahead should fail soft
    );
  }
}
