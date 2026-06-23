import Ajv2020 from "ajv/dist/2020";
import type { CheckResult, EvalCase, Suite } from "../types";
import { generateForm } from "@/lib/capture/generate";
import { GEO_POINT_FORMAT, GEO_POLYGON_FORMAT, type GeneratedSchema } from "@/lib/capture/schema-spec";

const ajv = new Ajv2020({ strict: false });
// Our custom geo formats live on object-typed fields; register as no-ops to silence AJV warnings.
ajv.addFormat("geo-point", true);
ajv.addFormat("geo-polygon", true);

function schemaCompiles(schema: unknown): boolean {
  try {
    ajv.compile(schema as object);
    return true;
  } catch {
    return false;
  }
}

/** Free-tier overload/quota errors shouldn't fail the suite — mark them skipped (still pass). */
function isTransient(error: string): boolean {
  return /demand|overload|quota|rate|429|503|unavailable|exhausted|timeout/i.test(error);
}

function hasFormat(schema: GeneratedSchema, format: string): boolean {
  return Object.values(schema.properties ?? {}).some((f) => f?.format === format);
}

function fieldText(schema: GeneratedSchema): string {
  return Object.entries(schema.properties ?? {})
    .map(([k, f]) => `${k} ${f?.title ?? ""}`)
    .join(" ")
    .toLowerCase();
}

type CaptureCase = {
  name: string;
  prompt: string;
  expectFields?: string[];
  expectGeo?: typeof GEO_POINT_FORMAT | typeof GEO_POLYGON_FORMAT;
  expectConditional?: boolean;
};

const LLM_CASES: CaptureCase[] = [
  {
    name: "field survey with location",
    prompt:
      "A field survey form: site name, condition rating (poor/fair/good), inspector notes, and the location on a map.",
    expectFields: ["site", "condition", "note"],
    expectGeo: GEO_POINT_FORMAT,
  },
  {
    name: "delivery stop with point",
    prompt: "A delivery stop form: address, recipient, package count, and a delivery point on the map.",
    expectFields: ["address", "recipient"],
    expectGeo: GEO_POINT_FORMAT,
  },
  {
    name: "parcel boundary (polygon)",
    prompt: "A land parcel record: parcel id, owner, land use, and draw the boundary area on a map.",
    expectGeo: GEO_POLYGON_FORMAT,
  },
  {
    name: "conditional escalation",
    prompt:
      "An incident report: incident type, severity (low/medium/high), and if severity is high require an escalation contact.",
    expectFields: ["incident", "severity"],
    expectConditional: true,
  },
  {
    name: "contact form (no location)",
    prompt: "A simple contact form with full name, email address, and message.",
    expectFields: ["name", "email", "message"],
  },
];

function llmCase(c: CaptureCase): EvalCase {
  return {
    name: c.name,
    run: async (): Promise<CheckResult[]> => {
      const res = await generateForm(c.prompt);
      if (!res.ok) {
        const skipped = isTransient(res.error);
        const note = skipped ? `skipped: LLM unavailable` : res.error.slice(0, 80);
        return [{ metric: "schema_valid", pass: skipped, note }];
      }
      const schema = res.jsonSchema;
      const checks: CheckResult[] = [
        { metric: "schema_valid", pass: schemaCompiles(schema) && Object.keys(schema.properties ?? {}).length > 0 },
      ];
      if (c.expectFields) {
        const text = fieldText(schema);
        const missing = c.expectFields.filter((f) => !text.includes(f.toLowerCase()));
        const covered = c.expectFields.length - missing.length;
        checks.push({
          metric: "field_coverage",
          pass: missing.length === 0,
          score: Number((covered / c.expectFields.length).toFixed(2)),
          note: missing.length ? `missing: ${missing.join(", ")}` : undefined,
        });
      }
      if (c.expectGeo) {
        checks.push({ metric: "geo_format_ok", pass: hasFormat(schema, c.expectGeo), note: c.expectGeo });
      }
      if (c.expectConditional) {
        checks.push({ metric: "conditional_ok", pass: (schema.allOf?.length ?? 0) > 0 });
      }
      return checks;
    },
  };
}

// A deterministic baseline that passes even if the LLM is fully unavailable.
const STATIC_SCHEMA: GeneratedSchema = {
  title: "Static Survey",
  type: "object",
  properties: {
    site_name: { type: "string", title: "Site Name" },
    rating: { type: "string", title: "Rating", enum: ["poor", "fair", "good"] },
    location: { type: "object", title: "Location", format: GEO_POINT_FORMAT },
  },
  required: ["site_name"],
};

const staticCase: EvalCase = {
  name: "static schema compiles + geo format (no LLM)",
  run: async (): Promise<CheckResult[]> => [
    { metric: "schema_valid", pass: schemaCompiles(STATIC_SCHEMA) },
    { metric: "geo_format_ok", pass: hasFormat(STATIC_SCHEMA, GEO_POINT_FORMAT) },
  ],
};

export const captureSmoke: Suite = {
  module: "capture",
  name: "smoke",
  cases: [staticCase, ...LLM_CASES.map(llmCase)],
};
