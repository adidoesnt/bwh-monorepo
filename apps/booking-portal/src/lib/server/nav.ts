import type { NavBadges, Role } from "$lib/nav";
import { getClientActionableBookingCount } from "./queries";

/** Badge counts for the sidebar, scoped to what each role actually sees. */
export const getNavBadges = async (role: Role, userId: string): Promise<NavBadges> => {
  if (role !== "client") return {};

  const bookingsCount = await getClientActionableBookingCount(userId);
  return { bookings: bookingsCount > 0 ? String(bookingsCount) : null };
};
