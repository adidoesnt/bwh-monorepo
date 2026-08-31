import { env } from "$env/dynamic/private";
import { getRequestEvent } from "$app/server";
import { createAuth } from "@repo/database";

export const auth = createAuth({
  databaseUrl: env.DATABASE_URL,
  baseURL: env.AUTH_BASE_URL,
  getRequestEvent,
});
