import { fail, type RequestEvent } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { availabilitySlot } from "@repo/database/schema";
import { zonedDateParts, zonedStartOfDay } from "$lib/utils/availability";
import { cellsToWindows, windowsToCells, type WeeklyWindow } from "$lib/utils/availabilityEditor";
import { lockCoach } from "./bookings";
import { db } from "./db";
import { actionFailure } from "./errors";
import {
  getCoachAvailabilitySlots,
  getCoachPackages,
  getCoachProfileByUserId,
  getCoachUpcomingActiveBookings,
} from "./queries";

/** "Today" and "this week" (Monday–Sunday) in the coach's zone, not the server's. */
export const coachWeekBounds = (zone: string, now = new Date()) => {
  const daysSinceMonday = (zonedDateParts(now, zone).weekday + 6) % 7;
  return {
    todayStart: zonedStartOfDay(now, zone),
    tomorrowStart: zonedStartOfDay(now, zone, 1),
    weekStart: zonedStartOfDay(now, zone, -daysSinceMonday),
    weekEnd: zonedStartOfDay(now, zone, 7 - daysSinceMonday),
  };
};

/** What the weekly hours editor needs: the saved windows, every upcoming
 * session a change could land on, and the shortest session any active package
 * sells (`null` with no packages) — windows shorter than that only fit a free consult. */
export const getHoursEditorData = async (coachId: string) => {
  const [availability, upcomingActive, packages] = await Promise.all([
    getCoachAvailabilitySlots(coachId),
    getCoachUpcomingActiveBookings(coachId),
    getCoachPackages(coachId),
  ]);

  return {
    availability,
    upcomingActive,
    minSessionLength:
      packages.length > 0 ? Math.min(...packages.map((p) => p.sessionLengthMin)) : null,
  };
};

/** Replaces a coach's weekly hours. Runs under the coach lock so a request
 * being checked against the old hours finishes first, and the next one sees
 * the new hours. Existing bookings are untouched, even ones in hours that
 * just closed. */
export const saveWeeklyHours = (coachId: string, windows: WeeklyWindow[]) =>
  db.transaction(async (tx) => {
    await lockCoach(tx, coachId);

    // Merge touching or overlapping windows, as the editor does.
    const merged = cellsToWindows(windowsToCells(windows));

    await tx.delete(availabilitySlot).where(eq(availabilitySlot.coachId, coachId));
    if (merged.length > 0) {
      await tx.insert(availabilitySlot).values(merged.map((w) => ({ coachId, ...w })));
    }

    return merged;
  });

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

/** The `?/saveHours` form action, shared by the dashboard and the availability
 * page. Anyone with a coach profile edits their own hours — that includes an
 * admin who also coaches. */
export const saveHoursAction = async ({ locals, request }: RequestEvent) => {
  if (!locals.user || (locals.user.role !== "trainer" && locals.user.role !== "admin")) {
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
    if (!parsed?.success) {
      return fail(400, { message: "those hours aren't valid — check them and try again" });
    }

    await saveWeeklyHours(coach.id, parsed.data);
  } catch (err) {
    return actionFailure(err, "we couldn't save your hours — please try again");
  }
};
