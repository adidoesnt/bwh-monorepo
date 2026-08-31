import type { Handle } from "@sveltejs/kit";
import { redirect } from "@sveltejs/kit";
import { auth } from "$lib/server/auth";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from "$app/environment";

type Role = "client" | "trainer" | "admin";

const AUTH_PATH = "/";

/**
 * Where each role lands after login and when it strays into another role's area.
 * The trainer/admin route trees don't exist yet (Phase 2/9/10) — until they do,
 * every role lands on /dashboard. Point these at "/trainer" / "/admin" once built.
 */
const HOME_BY_ROLE: Record<Role, string> = {
  client: "/dashboard",
  trainer: "/dashboard",
  admin: "/dashboard",
};

/**
 * Any path under these prefixes requires a session. Shared surfaces
 * (/payments, /progress, /help) render per-role in their own load functions;
 * the role-exclusive areas are gated by `ROLE_AREAS` below.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/bookings",
  "/packages",
  "/payments",
  "/progress",
  "/intake",
  "/help",
  "/trainer",
  "/admin",
];

/** Prefixes only certain roles may enter. Admin may view the coach area. */
const ROLE_AREAS: { prefix: string; roles: Role[] }[] = [
  { prefix: "/trainer", roles: ["trainer", "admin"] },
  { prefix: "/admin", roles: ["admin"] },
];

const startsWithPath = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(prefix + "/");

export const handle: Handle = async ({ event, resolve }) => {
  const session = await auth.api.getSession({
    headers: event.request.headers,
  });

  event.locals.user = session?.user ?? null;
  event.locals.session = session?.session ?? null;

  const { pathname } = event.url;
  const role = (event.locals.user?.role as Role | undefined) ?? "client";

  const isProtected = PROTECTED_PREFIXES.some((p) => startsWithPath(pathname, p));

  if (isProtected && !event.locals.user) {
    redirect(303, AUTH_PATH);
  }

  if (event.locals.user) {
    // Logged-in users don't see the auth screen.
    if (pathname === AUTH_PATH) {
      redirect(303, HOME_BY_ROLE[role]);
    }

    // Keep each role inside its own area.
    const area = ROLE_AREAS.find((a) => startsWithPath(pathname, a.prefix));
    if (area && !area.roles.includes(role)) {
      redirect(303, HOME_BY_ROLE[role]);
    }
  }

  return svelteKitHandler({ event, resolve, auth, building });
};
