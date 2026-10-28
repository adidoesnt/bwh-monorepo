import type { PageServerLoad } from "./$types";
import {
  getClientUpcomingBookings,
  getClientUpcomingBookingsCount,
  getClientActivePackages,
  getClientRecentActivity,
  getClientCompletedSessionStats,
  getClientWeeklySessionCounts,
  getCoachProfileByUserId,
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
    view: "client" as const,
    upcomingBookings,
    upcomingBookingsCount,
    activePackages,
    recentActivity,
    completedSessionStats,
    weeklySessionCounts,
  };
};

const getTrainerData = async (userId: string) => {
  const coach = await getCoachProfileByUserId(userId);

  return { view: "trainer" as const, coach };
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
    case "trainer":
      return await getTrainerData(user.id);
    case "admin":
      return { view: "admin" as const };
    default:
      throw new Error("Invalid role");
  }
};
