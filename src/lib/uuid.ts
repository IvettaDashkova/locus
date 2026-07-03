/**
 * Guard a route's `[id]` path param before it reaches a `uuid`-typed column. A non-UUID string
 * (e.g. `/api/tracks/not-a-uuid`) would otherwise make Postgres throw "invalid input syntax for
 * type uuid", surfacing as a 500 — this lets the handler answer a clean 400 instead. Accepts any
 * RFC-4122 variant (version digit 1-8, incl. our v4 ids); case-insensitive.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}
