import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "@/lib/env";

// `prepare: false` keeps us compatible with the Supabase transaction-mode pooler (port 6543),
// which does not support prepared statements. Harmless against local docker / direct connections.
const client = postgres(env.DATABASE_URL, { prepare: false });

export const db = drizzle(client, { schema });
export { client };
