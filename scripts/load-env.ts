// Import this FIRST in any node-run script so process.env is populated from .env.local
// before other modules (db client, env validation) are evaluated.
import { config } from "dotenv";

config({ path: ".env.local" });
config(); // fall back to .env if present
