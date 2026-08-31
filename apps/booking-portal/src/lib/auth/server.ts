import { betterAuth } from "better-auth";
import { env } from "$env/dynamic/private";
import db from "$lib/database";

export const auth = betterAuth({
  database: db,
  baseURL: env.AUTH_BASE_URL,
  emailAndPassword: { enabled: true },
});
