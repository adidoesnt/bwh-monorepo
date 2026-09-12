import { redirect } from "@sveltejs/kit";
import { buildNav, roleLabel, type Role } from "$lib/nav";
import { getNavBadges } from "$lib/server/nav";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals }) => {
  // hooks.server.ts already guards these routes, but keep the type narrow.
  if (!locals.user) redirect(303, "/");

  const role = (locals.user.role as Role) ?? "client";

  const badges = await getNavBadges(role, locals.user.id);

  return {
    user: {
      id: locals.user.id,
      name: locals.user.name,
      email: locals.user.email,
      role,
      timezone: locals.user.timezone ?? null,
    },
    nav: buildNav(role, badges),
    roleLabel: roleLabel(role),
    sidebarNote: null as { title: string; body: string } | null,
  };
};
