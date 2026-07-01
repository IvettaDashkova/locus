import { z } from "zod";

/**
 * Capture's supported subset of JSON Schema (draft 2020-12) and the bridge from the LLM's output to
 * it. Two distinct shapes on purpose:
 *
 *   1. `emitInput` — what the `emit_schema` tool asks the LLM for. Fields are an **array** (each with
 *      a `name`), NOT a dynamic-keyed object. LLM structured output (esp. Gemini) fills fixed-shape
 *      arrays reliably but leaves open-ended record/map types empty — so we never ask for one.
 *   2. `generatedSchema` — the real JSON Schema we build from `emitInput` and that RJSF renders. Used
 *      as a final Zod guard on the built result.
 *
 * Kept flat (one level of array items) — nested objects are out of scope for Phase 1 (PLAN open Q4).
 */

export const GEO_POINT_FORMAT = "geo-point";
export const GEO_POLYGON_FORMAT = "geo-polygon";

const scalarType = z.enum(["string", "number", "integer", "boolean"]);
const fieldType = z.enum(["string", "number", "integer", "boolean", "array"]);
const scalarValue = z.union([z.string(), z.number(), z.boolean()]);

// ── 1. LLM-facing tool input ────────────────────────────────────────────────
const fieldDef = z.object({
  name: z.string().describe("snake_case property key"),
  type: fieldType,
  title: z.string().describe("human-readable label"),
  description: z.string().optional(),
  format: z.string().optional().describe(`geo-point | geo-polygon | email | date | uri`),
  enum: z.array(scalarValue).optional().describe("fixed set of allowed values"),
  required: z.boolean().optional(),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
  minLength: z.number().int().optional(),
  maxLength: z.number().int().optional(),
  pattern: z.string().optional(),
  itemType: scalarType.optional().describe("element type when type is array"),
  itemEnum: z.array(scalarValue).optional(),
});

const conditionalDef = z.object({
  whenField: z.string().describe("the field whose value triggers the condition"),
  equals: scalarValue.describe("value that activates the conditional fields"),
  requireFields: z.array(z.string()).optional().describe("fields required when the condition holds"),
});

export const emitInput = z.object({
  title: z.string(),
  description: z.string().optional(),
  fields: z.array(fieldDef).min(1),
  conditionals: z.array(conditionalDef).optional(),
});

export type EmitInput = z.infer<typeof emitInput>;

// ── 2. The built JSON Schema (validation guard) ─────────────────────────────
// Geo fields are built as `type: "object"` (their value is a GeoJSON object), so the built-schema
// validator must allow "object" even though the LLM never emits it directly.
const builtFieldType = z.enum(["string", "number", "integer", "boolean", "array", "object"]);

const fieldSchema = z.object({
  type: builtFieldType,
  title: z.string().optional(),
  description: z.string().optional(),
  format: z.string().optional(),
  enum: z.array(scalarValue).optional(),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
  minLength: z.number().int().optional(),
  maxLength: z.number().int().optional(),
  pattern: z.string().optional(),
  items: z.object({ type: scalarType, enum: z.array(scalarValue).optional() }).optional(),
});

export type FieldSchema = z.infer<typeof fieldSchema>;

const conditional = z.object({
  if: z.record(z.string(), z.any()),
  then: z.record(z.string(), z.any()),
});

export const generatedSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  type: z.literal("object"),
  properties: z.record(z.string(), fieldSchema),
  required: z.array(z.string()).optional(),
  allOf: z.array(conditional).optional(),
});

export type GeneratedSchema = z.infer<typeof generatedSchema>;
export type UiSchema = Record<string, unknown>;

/** Build the real JSON Schema (+ uiSchema) from the LLM's array-shaped emit input. */
export function buildSchema(input: EmitInput): { jsonSchema: GeneratedSchema; uiSchema: UiSchema } {
  const properties: Record<string, FieldSchema> = {};
  const required: string[] = [];

  for (const f of input.fields) {
    const isGeo = f.format === GEO_POINT_FORMAT || f.format === GEO_POLYGON_FORMAT;
    // A geo field's value is a GeoJSON object — render type "object" so AJV accepts it; the custom
    // RJSF field (keyed off `format`) handles input. Scalar constraints/enum don't apply.
    const prop: FieldSchema = isGeo
      ? { type: "object", title: f.title, format: f.format }
      : { type: f.type, title: f.title };

    if (f.description) prop.description = f.description;

    if (!isGeo) {
      if (f.format) prop.format = f.format;
      if (f.enum) prop.enum = f.enum;
      if (f.minimum !== undefined) prop.minimum = f.minimum;
      if (f.maximum !== undefined) prop.maximum = f.maximum;
      if (f.minLength !== undefined) prop.minLength = f.minLength;
      if (f.maxLength !== undefined) prop.maxLength = f.maxLength;
      if (f.pattern) prop.pattern = f.pattern;
      if (f.type === "array" && f.itemType) {
        prop.items = { type: f.itemType, ...(f.itemEnum ? { enum: f.itemEnum } : {}) };
      }
    }

    properties[f.name] = prop;
    if (f.required) required.push(f.name);
  }

  // JSON Schema `required` only constrains properties that exist, so a conditional that names a
  // field absent from `properties` is silently a no-op. Drop dangling references (and skip empties)
  // so every emitted conditional actually enforces something on both RJSF/AJV (client) and AJV (server).
  const known = new Set(Object.keys(properties));
  const allOf = (input.conditionals ?? [])
    .filter((c) => known.has(c.whenField))
    .map((c) => ({
      if: { properties: { [c.whenField]: { const: c.equals } }, required: [c.whenField] },
      then: { required: (c.requireFields ?? []).filter((f) => known.has(f)) },
    }))
    .filter((c) => c.then.required.length > 0);

  const jsonSchema: GeneratedSchema = {
    title: input.title,
    type: "object",
    properties,
    ...(input.description ? { description: input.description } : {}),
    ...(required.length ? { required } : {}),
    ...(allOf.length ? { allOf } : {}),
  };

  return { jsonSchema, uiSchema: deriveUiSchema(jsonSchema) };
}

/**
 * Derive an RJSF uiSchema: map geo formats to the custom widgets, mark the first geo-point as the
 * site location (overridable later), and pin field order.
 */
export function deriveUiSchema(schema: GeneratedSchema): UiSchema {
  const ui: UiSchema = {};
  const order: string[] = [];
  let siteLocationPicked = false;

  for (const [key, field] of Object.entries(schema.properties)) {
    order.push(key);
    if (field.format === GEO_POINT_FORMAT) {
      const options: Record<string, unknown> = {};
      if (!siteLocationPicked) {
        options.siteLocation = true;
        siteLocationPicked = true;
      }
      ui[key] = { "ui:field": "geoPoint", "ui:options": options };
    } else if (field.format === GEO_POLYGON_FORMAT) {
      ui[key] = { "ui:field": "geoPolygon" };
    }
  }

  ui["ui:order"] = order;
  return ui;
}

/** The field key designated as the site location (used at save time in 1.3). */
export function siteLocationField(schema: GeneratedSchema): string | null {
  for (const [key, field] of Object.entries(schema.properties)) {
    if (field.format === GEO_POINT_FORMAT) return key;
  }
  return null;
}
