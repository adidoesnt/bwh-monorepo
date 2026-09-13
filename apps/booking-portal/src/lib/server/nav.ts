import type { NavBadges, Role } from "$lib/nav";
import { getClientActionableBookingCount, getClientActivePackages } from "./queries";

/** Badge counts for the sidebar, scoped to what each role actually sees. */
export const getNavBadges = async (role: Role, userId: string): Promise<NavBadges> => {
  if (role !== "client") return {};

  const bookingsCount = await getClientActionableBookingCount(userId);
  const bookings = bookingsCount > 0 ? String(bookingsCount) : null;

  const packagesCount = (await getClientActivePackages(userId)).length;
  const packages = packagesCount > 0 ? String(packagesCount) : null;

  return { bookings, packages };
};
