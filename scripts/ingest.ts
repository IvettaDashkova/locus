import "./load-env";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { embedPassages } from "@/lib/ai/embeddings";
import { EMBEDDING } from "@/lib/ai/embeddings.config";

/**
 * Ingest the sample corpus + captured data into `chunks`: chunk → embed via the AI SDK (Gemini,
 * 768-d) → store with geom. Idempotent per source. Run: `npm run ingest`.
 */

type Doc = {
  source: string;
  entryId: string;
  title: string;
  content: string;
  url?: string | null;
  license?: string | null;
  lng?: number | null;
  lat?: number | null;
  siteId?: string | null;
};

function chunkText(text: string, size = 600, overlap = 80): string[] {
  const t = text.trim();
  if (t.length <= size) return [t];
  const out: string[] = [];
  for (let i = 0; i < t.length; i += size - overlap) out.push(t.slice(i, i + size));
  return out;
}

async function gatherDocs(sql: postgres.Sql): Promise<Doc[]> {
  const docs: Doc[] = [];

  const places = JSON.parse(await readFile("data/sample/places.json", "utf8")) as Doc[];
  docs.push(...places);

  const sites = await sql<
    { id: string; name: string; description: string | null; category: string | null; lng: number; lat: number }[]
  >`SELECT id, name, description, category, ST_X(geom) AS lng, ST_Y(geom) AS lat FROM sites`;
  for (const s of sites) {
    const content = [s.name, s.category, s.description].filter(Boolean).join(". ");
    docs.push({ source: "site", entryId: s.id, title: s.name, content, license: "internal", lng: s.lng, lat: s.lat, siteId: s.id });
  }

  const subs = await sql<
    { id: string; site_id: string | null; data: Record<string, unknown>; form: string; lng: number | null; lat: number | null }[]
  >`SELECT s.id, s.site_id, s.data, f.name AS form, ST_X(s.geom) AS lng, ST_Y(s.geom) AS lat
    FROM submissions s JOIN forms f ON f.id = s.form_id`;
  for (const sub of subs) {
    const fields = Object.entries(sub.data ?? {})
      .filter(([, v]) => v != null && typeof v !== "object")
      .map(([k, v]) => `${k}: ${v}`)
      .join("; ");
    if (!fields) continue;
    docs.push({ source: "submission", entryId: sub.id, title: sub.form, content: fields, license: "internal", lng: sub.lng, lat: sub.lat, siteId: sub.site_id });
  }

  return docs;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (check .env.local)");
  const sql = postgres(url, { max: 1 });
  try {
    const docs = await gatherDocs(sql);
    const records = docs.flatMap((doc) => chunkText(doc.content).map((text, index) => ({ doc, index, text })));
    console.log(`embedding ${records.length} chunks from ${docs.length} docs (${EMBEDDING.model})…`);
    const vectors = await embedPassages(records.map((r) => r.text));

    const sources = [...new Set(docs.map((d) => d.source))];
    await sql`DELETE FROM chunks WHERE source = ANY(${sources})`;

    for (let i = 0; i < records.length; i++) {
      const { doc, index, text } = records[i];
      const vec = `[${vectors[i].join(",")}]`;
      const geom =
        doc.lng != null && doc.lat != null
          ? sql`ST_SetSRID(ST_MakePoint(${doc.lng}, ${doc.lat}), 4326)`
          : sql`NULL`;
      await sql`
        INSERT INTO chunks (source, entry_id, chunk_index, site_id, title, content, url, embedding, embedding_model, geom, license)
        VALUES (${doc.source}, ${doc.entryId}, ${index}, ${doc.siteId ?? null}, ${doc.title}, ${text},
                ${doc.url ?? null}, ${vec}::vector, ${EMBEDDING.model}, ${geom}, ${doc.license ?? null})
      `;
    }

    const [{ count }] = await sql<{ count: string }[]>`SELECT count(*)::text AS count FROM chunks`;
    console.log(`✓ ingested ${count} chunks`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
