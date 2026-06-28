import { NextResponse } from "next/server";
import Ajv2020 from "ajv/dist/2020";
import { getClient } from "@/db/client";
import { requireAuth } from "@/lib/auth/guard";
import { siteLocationField, type GeneratedSchema } from "@/lib/capture/schema-spec";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ajv = new Ajv2020({ strict: false, allErrors: true });
ajv.addFormat("geo-point", true);
ajv.addFormat("geo-polygon", true);

type Point = { type: "Point"; coordinates: [number, number] };

/** First GeoJSON Polygon found among a submission's data values (used for the map when no point). */
function findPolygon(data: Record<string, unknown> | null): unknown {
  for (const v of Object.values(data ?? {})) {
    if (typeof v === "object" && v !== null && (v as { type?: string }).type === "Polygon") return v;
  }
  return null;
}

/** GET → recent submissions for the list, map pins, and detail view. */
export async function GET() {
  try {
    const sql = getClient();
    const rows = await sql<
      { id: string; form_name: string; site_name: string | null; data: Record<string, unknown>; geom: string | null; created_at: string }[]
    >`
      SELECT s.id, f.name AS form_name, si.name AS site_name,
             s.data, ST_AsGeoJSON(s.geom) AS geom, s.created_at
      FROM submissions s
      JOIN forms f ON f.id = s.form_id
      LEFT JOIN sites si ON si.id = s.site_id
      ORDER BY s.created_at DESC
      LIMIT 100
    `;
    const items = rows.map((r) => ({
      id: r.id,
      formName: r.form_name,
      siteName: r.site_name,
      data: r.data,
      geometry: r.geom ? JSON.parse(r.geom) : findPolygon(r.data),
      createdAt: r.created_at,
    }));
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

function isPoint(v: unknown): v is Point {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as Point).type === "Point" &&
    Array.isArray((v as Point).coordinates) &&
    (v as Point).coordinates.length === 2
  );
}

/** Pick a human name for a created site: a "name"-ish string field, else the form title. */
function pickSiteName(data: Record<string, unknown>, fallback: string): string {
  for (const [key, value] of Object.entries(data)) {
    if (/name|title|label/i.test(key) && typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return fallback;
}

export async function POST(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

  let body: {
    name?: string;
    jsonSchema?: GeneratedSchema;
    uiSchema?: Record<string, unknown>;
    data?: Record<string, unknown>;
    siteId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { name, jsonSchema, uiSchema, data, siteId: providedSiteId } = body;
  if (!jsonSchema || typeof jsonSchema !== "object" || !data || typeof data !== "object") {
    return NextResponse.json({ error: "jsonSchema and data are required." }, { status: 400 });
  }

  // Server-side guard: never trust the client's data.
  let validate;
  try {
    validate = ajv.compile(jsonSchema as object);
  } catch (e) {
    return NextResponse.json({ error: `Invalid schema: ${e instanceof Error ? e.message : e}` }, { status: 400 });
  }
  if (!validate(data)) {
    return NextResponse.json({ error: "Data does not match the schema.", issues: validate.errors }, { status: 422 });
  }

  // Locate the designated geo-point (becomes the submission/site location).
  const locField = siteLocationField(jsonSchema);
  const point = locField ? data[locField] : null;
  const coords = isPoint(point) ? point.coordinates : null;

  const formName = (name ?? jsonSchema.title ?? "Untitled form").toString();
  const sql = getClient();

  try {
    const result = await sql.begin(async (tx) => {
      const [form] = await tx<{ id: string }[]>`
        INSERT INTO forms (name, json_schema, ui_schema)
        VALUES (${formName}, ${JSON.stringify(jsonSchema)}::jsonb, ${JSON.stringify(uiSchema ?? {})}::jsonb)
        RETURNING id
      `;

      let siteId: string | null = providedSiteId ?? null;
      let siteName: string | null = null;

      if (!siteId && coords) {
        const resolvedName = pickSiteName(data, formName);
        const [site] = await tx<{ id: string; name: string }[]>`
          INSERT INTO sites (name, geom)
          VALUES (${resolvedName}, ST_SetSRID(ST_MakePoint(${coords[0]}, ${coords[1]}), 4326))
          RETURNING id, name
        `;
        siteId = site.id;
        siteName = site.name;
      }

      const geom = coords
        ? tx`ST_SetSRID(ST_MakePoint(${coords[0]}, ${coords[1]}), 4326)`
        : tx`NULL`;
      const [submission] = await tx<{ id: string }[]>`
        INSERT INTO submissions (form_id, site_id, data, geom)
        VALUES (${form.id}, ${siteId}, ${JSON.stringify(data)}::jsonb, ${geom})
        RETURNING id
      `;

      return { submissionId: submission.id, siteId, siteName };
    });

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
