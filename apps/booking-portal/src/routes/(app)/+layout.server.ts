import { redirect } from "@sveltejs/kit";
import { buildNav, roleLabel, type NavBadges, type Role } from "$lib/nav";
import { getClientNavBadges } from "$lib/server/queries";
import type { LayoutServerLoad } from "./$types";

/** Sidebar note shown at the bottom of the nav, per role. */
function sidebarNote(role: Role, badges: NavBadges): { title: string; body: string } | null {
  if (role === "client" && badges.intake === "!") {
    return {
      title: "screening incomplete",
      body: "finish your par-q before your first session.",
    };
  }
  return null;
}

export const load: LayoutServerLoad = async ({ locals }) => {
  // hooks.server.ts already guards these routes, but keep the type narrow.
  if (!locals.user) redirect(303, "/");

  const role = (locals.user.role as Role) ?? "client";

  const badges: NavBadges = {};
  if (role === "client") {
    const b = await getClientNavBadges(locals.user.id);
    if (b.actionNeeded > 0) badges.bookings = String(b.actionNeeded);
    if (b.creditBalance > 0) badges.packages = String(b.creditBalance);
    if (!b.intakeComplete) badges.intake = "!";
  }

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
    sidebarNote: sidebarNote(role, badges),
  };
};
