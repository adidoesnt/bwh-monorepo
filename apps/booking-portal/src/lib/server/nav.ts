import type { NavBadges, Role } from "$lib/nav";
import {
  getClientActionableBookingCount,
  getClientActivePackages,
  getCoachPendingRequestCount,
  getCoachProfileByUserId,
  getCoachRescheduleRequests,
  getCoachSessionsToClose,
} from "./queries";

const countBadge = (count: number) => (count > 0 ? String(count) : null);

/** Badge counts for the sidebar, scoped to what each role actually sees. */
export const getNavBadges = async (role: Role, userId: string): Promise<NavBadges> => {
  if (role === "trainer") {
    const coach = await getCoachProfileByUserId(userId);
    if (!coach) return {};

    const [requests, reschedules, toClose] = await Promise.all([
      getCoachPendingRequestCount(coach.id),
      getCoachRescheduleRequests(coach.id),
      getCoachSessionsToClose(coach.id),
    ]);

    return { trainerActions: countBadge(requests + reschedules.length + toClose.length) };
  }

  if (role !== "client") return {};

  const bookings = countBadge(await getClientActionableBookingCount(userId));
  const packages = countBadge((await getClientActivePackages(userId)).length);

  return { bookings, packages };
};
