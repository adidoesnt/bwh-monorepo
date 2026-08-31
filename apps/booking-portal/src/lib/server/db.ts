import { env } from "$env/dynamic/private";
import { createDb } from "@repo/database";

export const db = createDb(env.DATABASE_URL);
