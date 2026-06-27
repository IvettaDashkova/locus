import { NextResponse } from "next/server";
import { getTrack } from "@/lib/tracks/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET → one track with its ordered fixes (playback + charts) and move/stop segments. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const detail = await getTrack(id);
    if (!detail) return NextResponse.json({ error: "Track not found." }, { status: 404 });
    return NextResponse.json(detail);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
