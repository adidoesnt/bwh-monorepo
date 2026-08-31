import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { sveltekitCookies } from "better-auth/svelte-kit";
import type { RequestEvent } from "@sveltejs/kit";
import { createDb, schema } from "../db";

export function createAuth({
  databaseUrl,
  baseURL,
  getRequestEvent,
}: {
  databaseUrl: string;
  baseURL: string;
  getRequestEvent: () => RequestEvent;
}) {
  const db = createDb(databaseUrl);

  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg", schema }),
    baseURL,
    emailAndPassword: { enabled: true },
    plugins: [sveltekitCookies(getRequestEvent)],
  });
}
