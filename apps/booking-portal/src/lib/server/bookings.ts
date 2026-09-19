import { sql } from "drizzle-orm";
import { zonedDateParts } from "$lib/utils/availability";
import { db } from "./db";
import {
  createBooking,
  getClientActivePackages,
  getCoachSlotsForDate,
} from "./queries";

/** Requests a session, re-checking the two things concurrent requests can
 * race on — the slot still being free, and the package still having a
 * session to hold — inside the same transaction as the insert.
 *
 * The advisory lock is per coach: slot conflicts are between different
 * clients of the same coach, and a package purchase belongs to exactly one
 * coach, so one lock covers both. A second request waits for the first to
 * commit and then sees its booking instead of racing past the checks. */
export const bookSession = (
  values: Parameters<typeof createBooking>[0],
  coachTimezone: string,
) =>
  db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`coach:${values.coachId}`}))`,
    );

    if (values.packagePurchaseId) {
      const packages = await getClientActivePackages(
        values.clientId,
        values.coachId,
        tx,
      );
      const purchase = packages.find(
        (p) => p.purchaseId === values.packagePurchaseId,
      );
      if (!purchase || purchase.bookable < 1) {
        return {
          ok: false as const,
          message: "no sessions left on that package right now",
        };
      }
    }

    const slots = await getCoachSlotsForDate(
      {
        coachId: values.coachId,
        zone: coachTimezone,
        date: zonedDateParts(values.startsAt, coachTimezone),
        durationMin: values.durationMin,
      },
      tx,
    );
    const slot = slots.find(
      (s) => s.start.getTime() === values.startsAt.getTime(),
    );
    if (!slot?.available) {
      return {
        ok: false as const,
        message: "that slot's no longer available — pick another time",
      };
    }

    const created = await createBooking(values, tx);
    return { ok: true as const, booking: created };
  });
