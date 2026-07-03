import { NextResponse } from "next/server";
import { getClient } from "@/db/client";
import { getTrack } from "@/lib/tracks/queries";
import { requireUser, currentUserId } from "@/lib/auth/guard";
import { isActivity } from "@/lib/tracks/presets";
import { isUuid } from "@/lib/uuid";

/** A malformed `[id]` (not a UUID) is a bad request, not a 404 — and never let it reach the uuid column. */
const badId = () => NextResponse.json({ error: "Invalid track id." }, { status: 400 });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET → one track with its ordered fixes (playback + charts) and move/stop segments. Public; flags `canEdit`. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return badId();
  try {
    const detail = await getTrack(id);
    if (!detail) return NextResponse.json({ error: "Track not found." }, { status: 404 });
    const uid = await currentUserId();
    detail.track.canEdit = !!uid && detail.track.userId === uid;
    return NextResponse.json(detail);
  } catch (e) {
    console.error("track GET failed", e);
    return NextResponse.json({ error: "Internal error." }, { status: 500 });
  }
}

/** PATCH → rename / re-tag a track. Owner only. Body: { name?, activity?, description? }. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireUser();
  if (who instanceof NextResponse) return who;
  const { id } = await params;
  if (!isUuid(id)) return badId();

  let body: { name?: unknown; activity?: unknown; description?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  if (name !== undefined && !name) {
    return NextResponse.json({ error: "Name cannot be empty." }, { status: 422 });
  }
  const activity =
    body.activity === null ? null : typeof body.activity === "string" ? body.activity : undefined;
  if (typeof activity === "string" && !isActivity(activity)) {
    return NextResponse.json({ error: "Invalid activity." }, { status: 422 });
  }
  const description =
    body.description === null ? null : typeof body.description === "string" ? body.description : undefined;

  try {
    const sql = getClient();
    // COALESCE keeps the existing value when a field is omitted (undefined → SQL NULL → keep).
    const rows = await sql<{ id: string }[]>`
      UPDATE tracks SET
        name = COALESCE(${name ?? null}, name),
        activity = ${activity === undefined ? sql`activity` : activity},
        description = ${description === undefined ? sql`description` : description}
      WHERE id = ${id} AND user_id = ${who.id}
      RETURNING id
    `;
    if (!rows.length) {
      return NextResponse.json({ error: "Not found or not yours." }, { status: 404 });
    }
    return NextResponse.json({ id: rows[0].id });
  } catch (e) {
    console.error("track PATCH failed", e);
    return NextResponse.json({ error: "Internal error." }, { status: 500 });
  }
}

/** DELETE → remove a track (and its points/segments, via ON DELETE CASCADE). Owner only. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireUser();
  if (who instanceof NextResponse) return who;
  const { id } = await params;
  if (!isUuid(id)) return badId();

  try {
    const sql = getClient();
    const rows = await sql<{ id: string }[]>`
      DELETE FROM tracks WHERE id = ${id} AND user_id = ${who.id} RETURNING id
    `;
    if (!rows.length) {
      return NextResponse.json({ error: "Not found or not yours." }, { status: 404 });
    }
    return NextResponse.json({ id: rows[0].id });
  } catch (e) {
    console.error("track DELETE failed", e);
    return NextResponse.json({ error: "Internal error." }, { status: 500 });
  }
}
