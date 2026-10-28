import type { PageServerLoad } from "./$types";
import { coachWeekBounds } from "$lib/server/availability";
import {
  getClientUpcomingBookings,
  getClientUpcomingBookingsCount,
  getClientActivePackages,
  getClientRecentActivity,
  getClientCompletedSessionStats,
  getClientWeeklySessionCounts,
  getCoachProfileByUserId,
  getCoachSessionsBetween,
  getCoachPendingRequests,
  getCoachSessionsToClose,
  getCoachActiveClientStats,
  getCoachAvailabilitySlots,
  type CoachSession,
  type CoachPendingRequest,
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

const EMPTY_TRAINER_DATA = {
  weekSessions: [] as CoachSession[],
  todaySessions: [] as CoachSession[],
  pendingRequests: [] as CoachPendingRequest[],
  sessionsToClose: [] as CoachSession[],
  activeClientStats: { count: 0, runningLow: 0 },
  weekStart: new Date(),
  availability: [] as Awaited<ReturnType<typeof getCoachAvailabilitySlots>>,
};

const getTrainerData = async (userId: string) => {
  const coach = await getCoachProfileByUserId(userId);
  if (!coach) return { view: "trainer" as const, coach, ...EMPTY_TRAINER_DATA };

  const { todayStart, tomorrowStart, weekStart, weekEnd } = coachWeekBounds(coach.timezone);

  const [weekSessions, pendingRequests, sessionsToClose, activeClientStats, availability] =
    await Promise.all([
      getCoachSessionsBetween(coach.id, weekStart, weekEnd),
      getCoachPendingRequests(coach.id),
      getCoachSessionsToClose(coach.id),
      getCoachActiveClientStats(coach.id),
      getCoachAvailabilitySlots(coach.id),
    ]);

  const todaySessions = weekSessions.filter(
    (s) => s.startsAt >= todayStart && s.startsAt < tomorrowStart,
  );

  return {
    view: "trainer" as const,
    coach,
    weekSessions,
    todaySessions,
    pendingRequests,
    sessionsToClose,
    activeClientStats,
    weekStart,
    availability,
  };
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
