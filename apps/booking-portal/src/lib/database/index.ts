import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "$env/dynamic/private";

import schema from "./schema";

const db = drizzle(new Pool({ connectionString: env.DATABASE_URL }), {
  schema,
});

export default db;
