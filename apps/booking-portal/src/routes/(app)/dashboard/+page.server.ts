import { fail } from "@sveltejs/kit";
import { z } from "zod";
import type { Actions, PageServerLoad } from "./$types";
import { saveWeeklyHours } from "$lib/server/availability";
import { actionFailure } from "$lib/server/errors";
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
  getCoachPackages,
  getCoachUpcomingActiveBookings,
  type CoachSession,
  type CoachPendingRequest,
} from "$lib/server/queries";
import { zonedDateParts, zonedStartOfDay } from "$lib/utils/availability";

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
  availability: [] as Awaited<ReturnType<typeof getCoachAvailabilitySlots>>,
  weekStart: new Date(),
  upcomingActive: [] as CoachSession[],
  minSessionLength: null as number | null,
};

const getTrainerData = async (userId: string) => {
  const coach = await getCoachProfileByUserId(userId);
  if (!coach) return { view: "trainer" as const, coach, ...EMPTY_TRAINER_DATA };

  // "Today" and "this week" (Monday–Sunday) are the coach's, not the server's.
  const now = new Date();
  const { weekday } = zonedDateParts(now, coach.timezone);
  const daysSinceMonday = (weekday + 6) % 7;
  const todayStart = zonedStartOfDay(now, coach.timezone);
  const tomorrowStart = zonedStartOfDay(now, coach.timezone, 1);
  const weekStart = zonedStartOfDay(now, coach.timezone, -daysSinceMonday);
  const weekEnd = zonedStartOfDay(now, coach.timezone, 7 - daysSinceMonday);

  const [
    weekSessions,
    pendingRequests,
    sessionsToClose,
    activeClientStats,
    availability,
    upcomingActive,
    packages,
  ] = await Promise.all([
    getCoachSessionsBetween(coach.id, weekStart, weekEnd),
    getCoachPendingRequests(coach.id),
    getCoachSessionsToClose(coach.id),
    getCoachActiveClientStats(coach.id),
    getCoachAvailabilitySlots(coach.id),
    getCoachUpcomingActiveBookings(coach.id),
    getCoachPackages(coach.id),
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
    availability,
    weekStart,
    upcomingActive,
    // Shortest session any active package sells — windows shorter than this
    // only ever fit a free consult. `null` when there are no packages.
    minSessionLength:
      packages.length > 0 ? Math.min(...packages.map((p) => p.sessionLengthMin)) : null,
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

const halfHour = z.number().int().multipleOf(30);
const weeklyHoursSchema = z.array(
  z
    .object({
      weekday: z.number().int().min(0).max(6),
      startMin: halfHour.min(0).max(24 * 60 - 30),
      endMin: halfHour.min(30).max(24 * 60),
    })
    .refine((w) => w.endMin > w.startMin),
);

export const actions: Actions = {
  saveHours: async ({ locals, request }) => {
    if (!locals.user || locals.user.role !== "trainer") {
      return fail(403, { message: "not allowed" });
    }

    try {
      const coach = await getCoachProfileByUserId(locals.user.id);
      if (!coach) return fail(403, { message: "not allowed" });

      const raw = (await request.formData()).get("windows");
      let parsed;
      try {
        parsed = weeklyHoursSchema.safeParse(JSON.parse(String(raw)));
      } catch {
        parsed = null;
      }
      if (!parsed?.success) return fail(400, { message: "those hours aren't valid — check them and try again" });

      await saveWeeklyHours(coach.id, parsed.data);
    } catch (err) {
      return actionFailure(err, "we couldn't save your hours — please try again");
    }
  },
};
