import { describe, it, expect } from "vitest";
import {
  buildSchema,
  generatedSchema,
  siteLocationField,
  GEO_POINT_FORMAT,
  type EmitInput,
} from "./schema-spec";

const base: EmitInput = {
  title: "Site visit",
  fields: [
    { name: "site_name", type: "string", title: "Site name", required: true },
    { name: "location", type: "string", title: "Location", format: GEO_POINT_FORMAT },
    { name: "has_damage", type: "boolean", title: "Damage?" },
    { name: "damage_notes", type: "string", title: "Damage notes" },
  ],
  conditionals: [
    { whenField: "has_damage", equals: true, requireFields: ["damage_notes"] },
    // Dangling: references a field that doesn't exist — must be dropped, not emitted as a no-op.
    { whenField: "ghost", equals: true, requireFields: ["damage_notes"] },
  ],
};

describe("buildSchema", () => {
  it("renders a geo-point as a typed object with its format, and marks it the site location", () => {
    const { jsonSchema } = buildSchema(base);
    expect(jsonSchema.properties.location).toEqual({ type: "object", title: "Location", format: GEO_POINT_FORMAT });
    expect(siteLocationField(jsonSchema)).toBe("location");
  });

  it("emits required and drops conditionals whose trigger field is unknown", () => {
    const { jsonSchema } = buildSchema(base);
    expect(jsonSchema.required).toEqual(["site_name"]);
    expect(jsonSchema.allOf).toHaveLength(1); // only the has_damage one survives; ghost is dropped
    expect(jsonSchema.allOf?.[0].if.required).toEqual(["has_damage"]);
    expect(jsonSchema.allOf?.[0].then.required).toEqual(["damage_notes"]);
  });
});

describe("generatedSchema guard (server-side trust boundary)", () => {
  it("accepts a schema we built ourselves", () => {
    const { jsonSchema } = buildSchema(base);
    expect(generatedSchema.safeParse(jsonSchema).success).toBe(true);
  });

  it("strips $ref/$id/$defs so they never reach ajv.compile (DoS surface)", () => {
    const hostile = {
      title: "Evil",
      type: "object",
      properties: { a: { type: "string" } },
      $ref: "#/$defs/loop",
      $id: "urn:evil",
      $defs: { loop: { $ref: "#/$defs/loop" } },
    };
    const parsed = generatedSchema.safeParse(hostile);
    expect(parsed.success).toBe(true);
    expect(parsed.data).not.toHaveProperty("$ref");
    expect(parsed.data).not.toHaveProperty("$id");
    expect(parsed.data).not.toHaveProperty("$defs");
  });

  it("rejects a schema that isn't an object schema or lacks required shape", () => {
    expect(generatedSchema.safeParse({ $ref: "#/x" }).success).toBe(false);
    expect(generatedSchema.safeParse({ title: "x", type: "array", properties: {} }).success).toBe(false);
  });
});
