import type { PageServerLoad } from "./$types";
import {
  getClientUpcomingBookings,
  getClientUpcomingBookingsCount,
  getClientActivePackages,
  getClientRecentActivity,
  getClientCompletedSessionStats,
  getClientWeeklySessionCounts,
} from "$lib/server/queries";

const UPCOMING_BOOKINGS_PREVIEW_COUNT = 3;

const getClientData = async (clientId: string) => {
  const [
    upcomingBookings,
    upcomingBookingsCount,
    activePackages,
    recentActivity,
    completedSessionStats,
    weeklySessionCounts,
  ] = await Promise.all([
    getClientUpcomingBookings(clientId, UPCOMING_BOOKINGS_PREVIEW_COUNT),
    getClientUpcomingBookingsCount(clientId),
    getClientActivePackages(clientId),
    getClientRecentActivity(clientId),
    getClientCompletedSessionStats(clientId),
    getClientWeeklySessionCounts(clientId),
  ]);

  return {
    upcomingBookings,
    upcomingBookingsCount,
    activePackages,
    recentActivity,
    completedSessionStats,
    weeklySessionCounts,
  };
};

const EMPTY_DASHBOARD_DATA = {
  upcomingBookings: [],
  upcomingBookingsCount: 0,
  activePackages: [],
  recentActivity: [],
  completedSessionStats: { count: 0, since: null },
  weeklySessionCounts: { thisWeek: 0, lastWeek: 0 },
};

export const load: PageServerLoad = async ({
  locals,
}: {
  locals: App.Locals;
}) => {
  const { user } = locals;

  switch (user?.role) {
    case "client":
      return await getClientData(user.id);
    case "admin":
      console.warn("Admin dashboard not implemented yet!");
      return EMPTY_DASHBOARD_DATA;
    case "trainer":
      console.warn("Trainer dashboard not implemented yet!");
      return EMPTY_DASHBOARD_DATA;
    default:
      throw new Error("Invalid role");
  }
};
