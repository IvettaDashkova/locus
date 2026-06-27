import "./load-env";
import postgres from "postgres";

// A handful of generic, domain-agnostic sites so the map has something to show.
// [name, category, description, lng, lat]
const SAMPLE_SITES: [string, string, string, number, number][] = [
  ["Harbor Field Office", "office", "Coastal operations base.", -122.4194, 37.7749],
  ["Riverside Survey Point", "survey", "Quarterly water-quality sampling site.", -0.1276, 51.5072],
  ["Central Depot", "depot", "Regional distribution hub.", 13.405, 52.52],
  ["Ridge Trailhead", "trailhead", "Start of the northern ridge route.", -106.8175, 39.1911],
  ["Old Town Inspection", "inspection", "Heritage building condition check.", 2.3522, 48.8566],
  ["Bay Monitoring Buoy", "sensor", "Tide and temperature telemetry.", 151.2093, -33.8688],
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (check .env.local)");

  // prepare:false keeps us compatible with the Supabase transaction-mode pooler (no prepared statements).
  const sql = postgres(url, { max: 1, prepare: false });
  try {
    await sql`DELETE FROM sites`;
    for (const [name, category, description, lng, lat] of SAMPLE_SITES) {
      await sql`
        INSERT INTO sites (name, category, description, geom)
        VALUES (${name}, ${category}, ${description}, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326))
      `;
    }
    const [{ count }] = await sql<{ count: string }[]>`SELECT count(*)::text AS count FROM sites`;
    console.log(`✓ seeded ${count} sites`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
