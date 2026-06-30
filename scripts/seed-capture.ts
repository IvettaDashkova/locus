import "./load-env";
import postgres from "postgres";
import { buildSchema } from "@/lib/capture/schema-spec";

/**
 * Deterministic, idempotent Capture seed: one realistic "Field site survey" form + several
 * submissions with geo-points across Europe, so the Capture map shows pins on a cold visit instead
 * of an empty screen. Re-running replaces only the seeded rows (matched by the form name and a
 * `properties.seed` marker on sites) — it never touches other data. Run: `npm run seed:capture`.
 */

const FORM_TITLE = "Field site survey (sample)";
const SITE_MARKER = "capture-sample";

// Built with the same buildSchema() the app uses, so the seeded form is identical to a generated one.
const { jsonSchema, uiSchema } = buildSchema({
  title: FORM_TITLE,
  description: "Quick condition check of a field site.",
  fields: [
    { name: "site_name", type: "string", title: "Site name", required: true },
    { name: "condition", type: "string", title: "Condition", enum: ["poor", "fair", "good"], required: true },
    { name: "notes", type: "string", title: "Notes" },
    { name: "location", type: "string", title: "Location", format: "geo-point", required: true },
  ],
});

// [siteName, condition, notes, lng, lat]
const SUBMISSIONS: [string, "poor" | "fair" | "good", string, number, number][] = [
  ["Miradouro de Santa Catarina", "good", "Recently restored railing; tiles intact.", -9.1466, 38.7095],
  ["Ribeira riverside walk", "fair", "Cobblestones uneven near the arch.", -8.6110, 41.1408],
  ["Hydropark riverbank", "good", "New benches installed; path clear.", 30.5760, 50.4460],
  ["Rynok Square frontage", "fair", "Facade plaster cracking on the north side.", 24.0316, 49.8419],
  ["Tempelhofer Feld edge", "good", "Drainage working after rain.", 13.4010, 52.4730],
  ["Motława quay", "poor", "Bollard loose; needs repair before the season.", 18.6570, 54.3490],
  ["Pirita coastal path", "good", "Signage updated; lighting OK.", 24.8330, 59.4700],
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (check .env.local)");

  // prepare:false → safe against the Supabase transaction pooler (6543) and direct (5432) alike.
  const sql = postgres(url, { max: 1, prepare: false });
  try {
    // Idempotent cleanup: deleting the form cascades its submissions; then drop seeded sites.
    // Match the marker via ::text LIKE so it catches rows regardless of jsonb encoding (self-healing).
    await sql`DELETE FROM forms WHERE name = ${FORM_TITLE}`;
    await sql`DELETE FROM sites WHERE properties::text LIKE ${"%" + SITE_MARKER + "%"}`;

    const [form] = await sql<{ id: string }[]>`
      INSERT INTO forms (name, json_schema, ui_schema)
      VALUES (${FORM_TITLE}, ${sql.json(jsonSchema as never)}, ${sql.json(uiSchema as never)})
      RETURNING id
    `;

    for (const [siteName, condition, notes, lng, lat] of SUBMISSIONS) {
      const [site] = await sql<{ id: string }[]>`
        INSERT INTO sites (name, category, description, geom, properties)
        VALUES (${siteName}, ${"survey"}, ${notes}, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326),
                ${sql.json({ seed: SITE_MARKER })})
        RETURNING id
      `;
      const data = {
        site_name: siteName,
        condition,
        notes,
        location: { type: "Point", coordinates: [lng, lat] },
      };
      await sql`
        INSERT INTO submissions (form_id, site_id, data, geom)
        VALUES (${form.id}, ${site.id}, ${sql.json(data as never)},
                ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326))
      `;
    }

    const [{ count }] = await sql<{ count: string }[]>`
      SELECT count(*)::text AS count FROM submissions WHERE form_id = ${form.id}
    `;
    console.log(`✓ seeded ${count} Capture submissions (form "${FORM_TITLE}") with map pins`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
