import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "./schema";
import { env } from "@/lib/env";

/**
 * Lazily constructed. Importing this module — which Next does when it collects route metadata at
 * build time — must NOT touch env or open a connection, otherwise a missing build-time
 * DATABASE_URL surfaces as "Failed to collect page data". The client/db are created on first use
 * (request time), when DATABASE_URL is guaranteed present.
 */
let _client: Sql | null = null;
let _db: PostgresJsDatabase<typeof schema> | null = null;

export function getClient(): Sql {
  // `prepare: false` keeps us compatible with the Supabase transaction-mode pooler (port 6543),
  // which does not support prepared statements. Harmless on local docker / direct connections.
  _client ??= postgres(env.DATABASE_URL, { prepare: false });
  return _client;
}

export function getDb(): PostgresJsDatabase<typeof schema> {
  _db ??= drizzle(getClient(), { schema });
  return _db;
}

/** Convenience accessor: `db.select()...` works without constructing anything at import time. */
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? value.bind(real) : value;
  },
});
