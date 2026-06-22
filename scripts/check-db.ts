import "./load-env";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (check .env.local)");

  const sql = postgres(url, { max: 1 });
  try {
    const ext = await sql<{ extname: string }[]>`
      SELECT extname FROM pg_extension WHERE extname IN ('postgis', 'vector', 'pg_trgm')
    `;
    const names = ext.map((r) => r.extname);
    const [{ postgis_version }] = await sql<{ postgis_version: string }[]>`SELECT postgis_version()`;

    console.log("extensions:", names.length ? names.join(", ") : "(none)");
    console.log("postgis:", postgis_version);

    const required = ["postgis", "vector"];
    const missing = required.filter((e) => !names.includes(e));
    if (missing.length) {
      console.error(`✗ missing required extension(s): ${missing.join(", ")}`);
      process.exit(1);
    }
    console.log("✓ postgis + vector present");
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
