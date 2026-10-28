import type { Actions, PageServerLoad } from "./$types";
import { coachWeekBounds, getHoursEditorData, saveHoursAction } from "$lib/server/availability";
import {
  getCoachPendingRequests,
  getCoachProfileByUserId,
  getCoachSessionsBetween,
} from "$lib/server/queries";

export const load: PageServerLoad = async ({ locals }) => {
  // hooks.server.ts already limits /trainer to trainers and admins.
  const coach = locals.user ? await getCoachProfileByUserId(locals.user.id) : null;
  if (!coach) return { coach: null };

  const { weekStart, weekEnd } = coachWeekBounds(coach.timezone);
  const [weekSessions, pendingRequests, hoursEditor] = await Promise.all([
    getCoachSessionsBetween(coach.id, weekStart, weekEnd),
    getCoachPendingRequests(coach.id),
    getHoursEditorData(coach.id),
  ]);

  return { coach, weekStart, weekSessions, pendingRequests, ...hoursEditor };
};

export const actions: Actions = {
  saveHours: saveHoursAction,
};
