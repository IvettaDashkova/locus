import { NextResponse } from "next/server";
import { seaRoute } from "@/lib/tracks/sea-route";
import { isActivity } from "@/lib/tracks/presets";
import { requireAuth } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isWaypoint = (v: unknown): v is [number, number] =>
  Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number" && Number.isFinite(n));

/**
 * POST { activity, waypoints } → { path: [lng,lat][] } — the polyline the route would follow, so the
 * builder can preview it live as the activity changes. Boats are routed by sea (around land); every
 * other activity goes straight through the drawn waypoints. No persistence; geometry only.
 *
 * Part of the (sign-in-gated) track builder, so it requires auth too — no anonymous compute.
 */
export async function POST(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

  let body: { activity?: unknown; waypoints?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const waypoints = Array.isArray(body.waypoints) ? body.waypoints.filter(isWaypoint) : [];
  if (waypoints.length < 2) return NextResponse.json({ path: waypoints });

  const path = body.activity === "boat" && isActivity(body.activity) ? seaRoute(waypoints) : waypoints;
  return NextResponse.json({ path });
}
