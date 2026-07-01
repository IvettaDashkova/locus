import { NextResponse } from "next/server";
import { getClient } from "@/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Deploy smoke test: DB reachable + PostGIS/pgvector present. Connects only at request time. */
export async function GET() {
  try {
    const sql = getClient();
    const ext = await sql<{ extname: string }[]>`
      SELECT extname FROM pg_extension WHERE extname IN ('postgis', 'vector')
    `;
    const names = ext.map((r) => r.extname);
    return NextResponse.json({
      db: "ok",
      postgis: names.includes("postgis"),
      vector: names.includes("vector"),
    });
  } catch (error) {
    // Report unhealthy without echoing the raw driver error (it can carry the connection string).
    console.error("health check failed", error);
    return NextResponse.json({ db: "error" }, { status: 500 });
  }
}
