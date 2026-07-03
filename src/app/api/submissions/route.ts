import { NextResponse } from "next/server";
import Ajv2020 from "ajv/dist/2020";
import { getClient } from "@/db/client";
import { requireAuth } from "@/lib/auth/guard";
import { siteLocationField, generatedSchema, type GeneratedSchema } from "@/lib/capture/schema-spec";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A fresh validator per request. Ajv.compile() caches every compiled schema by its serialized form,
// and each submitted form yields a distinct schema (different field names/enums/title), so a shared
// module-level instance would accumulate compiled schemas unboundedly over the process lifetime
// (a slow memory leak on long-lived Fluid Compute instances). A per-request Ajv is GC-able and cheap.
function makeValidator() {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  ajv.addFormat("geo-point", true);
  ajv.addFormat("geo-polygon", true);
  return ajv;
}

type Point = { type: "Point"; coordinates: [number, number] };

/** First GeoJSON Polygon found among a submission's data values (used for the map when no point). */
function findPolygon(data: Record<string, unknown> | null): unknown {
  for (const v of Object.values(data ?? {})) {
    if (typeof v === "object" && v !== null && (v as { type?: string }).type === "Polygon") return v;
  }
  return null;
}

/**
 * GET → recent submissions for the list, map pins, and detail view. Public read (like `GET /api/tracks`):
 * writes are auth-gated in POST, but the captured data is treated as shared, browsable demo content.
 */
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
    console.error("submissions GET failed", e);
    return NextResponse.json({ error: "Internal error." }, { status: 500 });
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

  const { name, uiSchema, data, siteId: providedSiteId } = body;
  if (!body.jsonSchema || typeof body.jsonSchema !== "object" || !data || typeof data !== "object") {
    return NextResponse.json({ error: "jsonSchema and data are required." }, { status: 400 });
  }

  // Re-derive the schema against our own Zod source of truth BEFORE compiling it. AJV.compile on a
  // raw client-supplied schema is a DoS surface ($ref recursion, ReDoS patterns, deep allOf);
  // `generatedSchema` has no $ref/$id branch, so this both rejects those and pins the trusted shape.
  const schemaParse = generatedSchema.safeParse(body.jsonSchema);
  if (!schemaParse.success) {
    return NextResponse.json({ error: "Unsupported form schema." }, { status: 400 });
  }
  const jsonSchema = schemaParse.data;

  // Server-side guard: never trust the client's data.
  let validate;
  try {
    validate = makeValidator().compile(jsonSchema as object);
  } catch {
    return NextResponse.json({ error: "Unsupported form schema." }, { status: 400 });
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
        VALUES (${formName}, ${sql.json(jsonSchema as never)}, ${sql.json((uiSchema ?? {}) as never)})
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
        VALUES (${form.id}, ${siteId}, ${sql.json(data as never)}, ${geom})
        RETURNING id
      `;

      return { submissionId: submission.id, siteId, siteName };
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("submissions POST failed", e);
    return NextResponse.json({ error: "Internal error." }, { status: 500 });
  }
}
