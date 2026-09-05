import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { sveltekitCookies } from "better-auth/svelte-kit";
import type { RequestEvent } from "@sveltejs/kit";
import { createDb, schema } from "../db";

export function createAuth({
  databaseUrl,
  baseURL,
  secret,
  getRequestEvent,
}: {
  databaseUrl: string;
  baseURL: string;
  /**
   * Signs session tokens. Passed through to better-auth; when undefined,
   * better-auth reads BETTER_AUTH_SECRET / AUTH_SECRET from the environment and
   * throws in production if neither is set. Each app resolves it in its
   * `src/lib/server/config` module.
   */
  secret?: string;
  getRequestEvent: () => RequestEvent;
}) {
  const db = createDb(databaseUrl);

  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg", schema }),
    baseURL,
    secret,
    emailAndPassword: { enabled: true },
    user: {
      additionalFields: {
        // client | trainer | admin — drives role-based route guards.
        role: {
          type: "string",
          required: false,
          defaultValue: "client",
          input: false,
        },
        // active | invited
        status: {
          type: "string",
          required: false,
          defaultValue: "active",
          input: false,
        },
        // IANA zone, or null until the user sets it.
        timezone: {
          type: "string",
          required: false,
          input: false,
        },
      },
    },
    plugins: [sveltekitCookies(getRequestEvent)],
  });
}
