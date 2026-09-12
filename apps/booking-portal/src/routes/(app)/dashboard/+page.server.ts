import type { PageServerLoad } from "./$types";
import {
  getClientUpcomingBookings,
  getClientActivePackages,
  getClientRecentActivity,
  getClientCompletedSessionStats,
  getClientWeeklySessionCounts,
} from "$lib/server/queries";

const getClientData = async (clientId: string) => {
  const [
    upcomingBookings,
    activePackages,
    recentActivity,
    completedSessionStats,
    weeklySessionCounts,
  ] = await Promise.all([
    getClientUpcomingBookings(clientId),
    getClientActivePackages(clientId),
    getClientRecentActivity(clientId),
    getClientCompletedSessionStats(clientId),
    getClientWeeklySessionCounts(clientId),
  ]);

  return {
    upcomingBookings,
    activePackages,
    recentActivity,
    completedSessionStats,
    weeklySessionCounts,
  };
};

const EMPTY_DASHBOARD_DATA = {
  upcomingBookings: [],
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
