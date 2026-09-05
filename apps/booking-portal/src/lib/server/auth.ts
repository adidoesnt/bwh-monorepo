import { DATABASE_URL, AUTH_BASE_URL } from "./config"
import { getRequestEvent } from "$app/server";
import { createAuth } from "@repo/database";

export const auth = createAuth({
  databaseUrl: DATABASE_URL,
  baseURL: AUTH_BASE_URL,
  getRequestEvent,
});
