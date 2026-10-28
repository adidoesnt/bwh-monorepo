import { eq } from "drizzle-orm";
import { availabilitySlot } from "@repo/database/schema";
import { cellsToWindows, windowsToCells, type WeeklyWindow } from "$lib/utils/availabilityEditor";
import { lockCoach } from "./bookings";
import { db } from "./db";

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
