import { NextResponse } from "next/server";
import { getClient } from "@/db/client";
import { requireUser, currentUserId } from "@/lib/auth/guard";
import { listTracks } from "@/lib/tracks/queries";
import { parseTrack } from "@/lib/tracks/parse";
import { insertTrack } from "@/lib/tracks/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET → all tracks with metrics + simplified paths (overview map + list). Public; `canEdit` flags the owner's. */
export async function GET() {
  try {
    const uid = await currentUserId();
    const tracks = (await listTracks()).map((t) => ({ ...t, canEdit: !!uid && t.userId === uid }));
    return NextResponse.json({ tracks });
  } catch (e) {
    console.error("tracks GET failed", e);
    return NextResponse.json({ error: "Internal error." }, { status: 500 });
  }
}

/**
 * POST { content, filename?, name? } → import a GPX/GeoJSON track. The file content is parsed,
 * metrics + segments are computed, and everything is persisted. Returns the new track's summary.
 */
export async function POST(req: Request) {
  const who = await requireUser();
  if (who instanceof NextResponse) return who;

  let body: { content?: unknown; filename?: unknown; name?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const content = typeof body.content === "string" ? body.content : "";
  if (!content.trim()) return NextResponse.json({ error: "A 'content' string is required." }, { status: 400 });
  if (content.length > 5_000_000) {
    return NextResponse.json({ error: "That track file is too large (max 5 MB)." }, { status: 413 });
  }

  try {
    const parsed = parseTrack(content, typeof body.filename === "string" ? body.filename : undefined);
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : parsed.name;
    if (parsed.points.length < 2) {
      return NextResponse.json({ error: "The track has fewer than two points." }, { status: 422 });
    }
    const stored = await insertTrack(getClient(), {
      name,
      activity: null,
      source: parsed.source,
      userId: who.id,
      points: parsed.points,
    });
    return NextResponse.json({ id: stored.id, name, metrics: stored.metrics, segmentCount: stored.segmentCount });
  } catch (e) {
    return NextResponse.json({ error: `Could not import the track: ${e instanceof Error ? e.message : String(e)}` }, { status: 422 });
  }
}
