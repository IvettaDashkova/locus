import { NextResponse } from "next/server";
import { getClient } from "@/db/client";
import { requireUser } from "@/lib/auth/guard";
import { synthesizeTrack } from "@/lib/tracks/synthesize";
import { routeToSynthConfig, isActivity } from "@/lib/tracks/presets";
import { seaRoute } from "@/lib/tracks/sea-route";
import { insertTrack } from "@/lib/tracks/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isWaypoint = (v: unknown): v is [number, number] =>
  Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number" && Number.isFinite(n));

/**
 * POST { name, activity, waypoints: [lng,lat][] } → build a track from a hand-drawn route. Timing
 * and speed are synthesized from the activity preset; the resulting fixes are run through the same
 * metrics + persistence path as imported tracks. Returns the new track's summary.
 */
export async function POST(req: Request) {
  const who = await requireUser();
  if (who instanceof NextResponse) return who;

  let body: { name?: unknown; activity?: unknown; waypoints?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const activity = body.activity;
  if (!isActivity(activity)) {
    return NextResponse.json({ error: "A valid 'activity' is required." }, { status: 400 });
  }
  const waypoints = Array.isArray(body.waypoints) ? body.waypoints.filter(isWaypoint) : [];
  if (waypoints.length < 2) {
    return NextResponse.json({ error: "At least two waypoints are required." }, { status: 422 });
  }
  const name =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim()
      : `${activity[0].toUpperCase()}${activity.slice(1)} route`;

  try {
    // Boats/ships must travel by sea: snap the drawn waypoints onto the global marine network and
    // route the shortest in-water path around land between them. Other activities go as-drawn.
    const drawn = waypoints as [number, number][];
    const pathWaypoints = activity === "boat" ? seaRoute(drawn) : drawn;
    const cfg = routeToSynthConfig(name, activity, pathWaypoints, new Date());
    const { points, source } = synthesizeTrack(cfg);
    const stored = await insertTrack(getClient(), { name, activity, source, userId: who.id, points });
    return NextResponse.json({ id: stored.id, name, metrics: stored.metrics });
  } catch (e) {
    return NextResponse.json(
      { error: `Could not build the track: ${e instanceof Error ? e.message : String(e)}` },
      { status: 422 },
    );
  }
}
