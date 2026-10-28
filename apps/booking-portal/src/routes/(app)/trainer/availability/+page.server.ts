import type { Actions, PageServerLoad } from "./$types";
import {
  coachWeekBounds,
  getCoachWeekOneOffs,
  getHoursEditorData,
  saveHoursAction,
} from "$lib/server/availability";
import {
  getCoachPendingRequests,
  getCoachProfileByUserId,
  getCoachSessionsBetween,
} from "$lib/server/queries";

export const load: PageServerLoad = async ({ locals }) => {
  // hooks.server.ts already limits /trainer to trainers and admins.
  const coach = locals.user ? await getCoachProfileByUserId(locals.user.id) : null;
  if (!coach) return { coach: null };

  const week = coachWeekBounds(coach.timezone);
  const [weekSessions, pendingRequests, weekOneOffs, hoursEditor] = await Promise.all([
    getCoachSessionsBetween(coach.id, week.weekStart, week.weekEnd),
    getCoachPendingRequests(coach.id),
    getCoachWeekOneOffs(coach.id, coach.timezone, week),
    getHoursEditorData(coach.id, coach.timezone),
  ]);

  return {
    coach,
    weekStart: week.weekStart,
    weekSessions,
    pendingRequests,
    weekOneOffs,
    ...hoursEditor,
  };
};

export const actions: Actions = {
  saveHours: saveHoursAction,
};
