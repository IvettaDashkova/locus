import { NextResponse } from "next/server";
import { trackHeatmap } from "@/lib/tracks/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET → a downsampled point FeatureCollection over all tracks (multi-track density heatmap). */
export async function GET() {
  try {
    return NextResponse.json(await trackHeatmap());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
