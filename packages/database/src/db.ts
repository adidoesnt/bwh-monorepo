import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import schema from "./schema";

export function createDb(connectionString: string) {
  return drizzle(new Pool({ connectionString }), { schema });
}

export type Database = ReturnType<typeof createDb>;
export { schema };
