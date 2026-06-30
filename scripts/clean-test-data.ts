import "./load-env";
import postgres from "postgres";

/**
 * One-off cleanup of throwaway test submissions created while developing/verifying the deployed app
 * (empty "note" rows with no geometry). Deletes ONLY forms whose name is in the explicit allowlist
 * below — deleting a form cascades its submissions. Everything else (real demo data, the seeded
 * "Field site survey (sample)", Incident Report, etc.) is left untouched. Idempotent. Prints what it
 * removes. Run: `npm run clean:test`.
 */
const TEST_FORM_NAMES = ["T", "Test form", "Prod test", "London Details", "Field Survey Form"];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (check .env.local)");
  const sql = postgres(url, { max: 1, prepare: false });
  try {
    const target = await sql<{ name: string; subs: number }[]>`
      SELECT f.name, count(s.id)::int AS subs
      FROM forms f LEFT JOIN submissions s ON s.form_id = f.id
      WHERE f.name = ANY(${TEST_FORM_NAMES})
      GROUP BY f.name ORDER BY f.name
    `;
    if (!target.length) {
      console.log("Nothing to clean — no matching test forms.");
      return;
    }
    console.log("Will delete these forms (and their submissions, via cascade):");
    for (const t of target) console.log(`  - "${t.name}" (${t.subs} submissions)`);

    const deleted = await sql<{ id: string }[]>`
      DELETE FROM forms WHERE name = ANY(${TEST_FORM_NAMES}) RETURNING id
    `;
    const [{ subs }] = await sql<{ subs: string }[]>`SELECT count(*)::text AS subs FROM submissions`;
    console.log(`✓ removed ${deleted.length} test form(s); ${subs} submissions remain.`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
