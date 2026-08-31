import type { Handle } from "@sveltejs/kit";
import { auth } from "$lib/server/auth";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from "$app/environment";

export const handle: Handle = async ({ event, resolve }) => {
  return svelteKitHandler({ event, resolve, auth, building });
};