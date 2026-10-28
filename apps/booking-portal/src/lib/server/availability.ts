import { fail, type RequestEvent } from "@sveltejs/kit";
import { and, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { availabilityException, availabilitySlot } from "@repo/database/schema";
import { zonedDateKey, zonedDateParts, zonedStartOfDay } from "$lib/utils/availability";
import {
  cellsToWindows,
  windowsToCells,
  type OneOffChange,
  type WeeklyWindow,
} from "$lib/utils/availabilityEditor";
import { lockCoach } from "./bookings";
import { db } from "./db";
import { actionFailure } from "./errors";
import {
  getCoachAvailabilityExceptions,
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

/** Upcoming one-off changes: everything not already over, so an entry that
 * started before today but runs on is still shown and editable. */
const ALL_FUTURE = "9999-12-31";

/** What the hours editor needs: the saved windows, today's upcoming one-off
 * changes, every upcoming session a change could land on, and the shortest
 * session any active package sells (`null` with no packages) — windows shorter
 * than that only fit a free consult. `today` is the coach's date. */
export const getHoursEditorData = async (coachId: string, zone: string) => {
  const today = zonedDateKey(new Date(), zone);
  const [availability, oneOffs, upcomingActive, packages] = await Promise.all([
    getCoachAvailabilitySlots(coachId),
    getCoachAvailabilityExceptions(coachId, today, ALL_FUTURE),
    getCoachUpcomingActiveBookings(coachId),
    getCoachPackages(coachId),
  ]);

  return {
    availability,
    oneOffs,
    today,
    upcomingActive,
    minSessionLength:
      packages.length > 0 ? Math.min(...packages.map((p) => p.sessionLengthMin)) : null,
  };
};

/** Replaces a coach's weekly hours and, if given, their upcoming one-off
 * changes (any ending `today` or later — finished ones are left as a record). Runs under the
 * coach lock so a request being checked against the old hours finishes first,
 * and the next one sees the new hours. Existing bookings are untouched, even
 * ones in hours that just closed. */
export const saveCoachHours = (
  coachId: string,
  windows: WeeklyWindow[],
  oneOffs: OneOffChange[] | undefined,
  today: string,
) =>
  db.transaction(async (tx) => {
    await lockCoach(tx, coachId);

    // Merge touching or overlapping windows, as the editor does.
    const merged = cellsToWindows(windowsToCells(windows));

    await tx.delete(availabilitySlot).where(eq(availabilitySlot.coachId, coachId));
    if (merged.length > 0) {
      await tx.insert(availabilitySlot).values(merged.map((w) => ({ coachId, ...w })));
    }

    if (!oneOffs) return;
    await tx
      .delete(availabilityException)
      .where(and(eq(availabilityException.coachId, coachId), gte(availabilityException.endDate, today)));
    if (oneOffs.length > 0) {
      await tx.insert(availabilityException).values(oneOffs.map((o) => ({ coachId, ...o })));
    }
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

// A real calendar date: "2026-02-30" parses (as 2 March) but doesn't read back the same.
const dateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((d) => !Number.isNaN(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d);
const oneOffsSchema = z.array(
  z
    .object({
      kind: z.enum(["closed", "open"]),
      startDate: dateKey,
      endDate: dateKey,
      startMin: halfHour.min(0).max(24 * 60 - 30),
      endMin: halfHour.min(30).max(24 * 60),
      note: z.string().trim().max(100).nullable().transform((n) => n || null),
    })
    .refine((o) => o.endDate >= o.startDate && o.endMin > o.startMin),
);

const parseJsonField = <T>(schema: z.ZodType<T>, raw: FormDataEntryValue | null) => {
  try {
    const parsed = schema.safeParse(JSON.parse(String(raw)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

/** The availability page's `?/saveHours` form action. Anyone with a coach
 * profile edits their own hours — that includes an admin who also coaches. */
export const saveHoursAction = async ({ locals, request }: RequestEvent) => {
  if (!locals.user || (locals.user.role !== "trainer" && locals.user.role !== "admin")) {
    return fail(403, { message: "not allowed" });
  }

  try {
    const coach = await getCoachProfileByUserId(locals.user.id);
    if (!coach) return fail(403, { message: "not allowed" });

    const formData = await request.formData();
    const windows = parseJsonField(weeklyHoursSchema, formData.get("windows"));
    // A save without the field leaves one-off changes alone rather than clearing them.
    const rawOneOffs = formData.get("oneOffs");
    const oneOffs = rawOneOffs === null ? undefined : parseJsonField(oneOffsSchema, rawOneOffs);
    if (!windows || oneOffs === null) {
      return fail(400, { message: "those hours aren't valid — check them and try again" });
    }

    const today = zonedDateKey(new Date(), coach.timezone);
    if (oneOffs?.some((o) => o.endDate < today)) {
      return fail(400, { message: "one-off changes have to end today or later" });
    }

    await saveCoachHours(coach.id, windows, oneOffs, today);
  } catch (err) {
    return actionFailure(err, "we couldn't save your hours — please try again");
  }
};
