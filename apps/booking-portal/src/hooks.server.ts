import type { Handle } from "@sveltejs/kit";
import { redirect } from "@sveltejs/kit";
import { auth } from "$lib/server/auth";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from "$app/environment";

const PROTECTED_PATHS = ["/dashboard"];
const AUTH_PATH = "/";

export const handle: Handle = async ({ event, resolve }) => {
  const session = await auth.api.getSession({
    headers: event.request.headers,
  });

  event.locals.user = session?.user ?? null;
  event.locals.session = session?.session ?? null;

  const isProtectedPath = PROTECTED_PATHS.some((path) =>
    event.url.pathname.startsWith(path),
  );

  if (isProtectedPath && !event.locals.user) {
    redirect(303, AUTH_PATH);
  }

  if (event.url.pathname === AUTH_PATH && event.locals.user) {
    redirect(303, "/dashboard");
  }

  return svelteKitHandler({ event, resolve, auth, building });
};
