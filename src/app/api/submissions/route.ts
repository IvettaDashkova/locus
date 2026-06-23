import { NextResponse } from "next/server";
import Ajv2020 from "ajv/dist/2020";
import { getClient } from "@/db/client";
import { siteLocationField, type GeneratedSchema } from "@/lib/capture/schema-spec";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ajv = new Ajv2020({ strict: false, allErrors: true });
ajv.addFormat("geo-point", true);
ajv.addFormat("geo-polygon", true);

type Point = { type: "Point"; coordinates: [number, number] };

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
        VALUES (${formName}, ${tx.json(jsonSchema as never)}, ${tx.json((uiSchema ?? {}) as never)})
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
        VALUES (${form.id}, ${siteId}, ${tx.json(data as never)}, ${geom})
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
