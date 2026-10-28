import { and, eq, sql } from "drizzle-orm";
import {
  booking,
  packagePurchase,
  sessionLedgerEntry,
} from "@repo/database/schema";
import { zonedDateParts } from "$lib/utils/availability";
import { db } from "./db";
import {
  createBooking,
  getClientActivePackages,
  getCoachSlotsForDate,
  type DbExecutor,
} from "./queries";

const lockCoach = (tx: DbExecutor, coachId: string) =>
  tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`coach:${coachId}`}))`);

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
    await lockCoach(tx, values.coachId);

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

/** A booking of this coach's that's still waiting on them, or a reason why
 * it can't be acted on. Read under the coach lock so it can't change between
 * this check and the caller's write. */
const getActionableRequest = async (
  tx: DbExecutor,
  bookingId: string,
  coachId: string,
) => {
  const [row] = await tx
    .select({
      id: booking.id,
      clientId: booking.clientId,
      type: booking.type,
      status: booking.status,
      startsAt: booking.startsAt,
      purchaseId: booking.packagePurchaseId,
    })
    .from(booking)
    .where(and(eq(booking.id, bookingId), eq(booking.coachId, coachId)));

  if (!row) return { ok: false as const, message: "that request doesn't exist" };
  if (row.status !== "pending_approval") {
    return { ok: false as const, message: "that request has already been handled" };
  }
  if (row.startsAt.getTime() <= Date.now()) {
    return { ok: false as const, message: "that session's time has already passed" };
  }
  return { ok: true as const, request: row };
};

/** Approves a request: confirms the booking and spends one session from its
 * package (`session_consumed −1`) in one transaction, under the same coach
 * lock `bookSession` takes so a new request can't race the balance check. */
export const approveBooking = (
  bookingId: string,
  coach: { id: string; slug: string },
) =>
  db.transaction(async (tx) => {
    await lockCoach(tx, coach.id);

    const found = await getActionableRequest(tx, bookingId, coach.id);
    if (!found.ok) return found;
    const { request } = found;

    if (request.purchaseId) {
      const [[purchase], [ledger]] = await Promise.all([
        tx
          .select({ expiresAt: packagePurchase.expiresAt })
          .from(packagePurchase)
          .where(eq(packagePurchase.id, request.purchaseId)),
        tx
          .select({
            balance: sql<number>`coalesce(sum(${sessionLedgerEntry.delta}), 0)`.mapWith(Number),
          })
          .from(sessionLedgerEntry)
          .where(eq(sessionLedgerEntry.purchaseId, request.purchaseId)),
      ]);

      if (!purchase || purchase.expiresAt < request.startsAt) {
        return { ok: false as const, message: "the client's package has expired" };
      }
      if (ledger.balance < 1) {
        return { ok: false as const, message: "the client has no sessions left on that package" };
      }

      await tx.insert(sessionLedgerEntry).values({
        clientId: request.clientId,
        purchaseId: request.purchaseId,
        bookingId: request.id,
        delta: -1,
        reason: "session_consumed",
        description: `${request.type} · ${coach.slug}`,
      });
    }

    await tx
      .update(booking)
      .set({ status: "confirmed" })
      .where(eq(booking.id, request.id));

    return { ok: true as const };
  });

/** Declines a request. Nothing was spent at request time, so there's no
 * ledger entry — cancelling it is what releases the client's hold. */
export const declineBooking = (bookingId: string, coachId: string) =>
  db.transaction(async (tx) => {
    await lockCoach(tx, coachId);

    const found = await getActionableRequest(tx, bookingId, coachId);
    if (!found.ok) return found;

    await tx
      .update(booking)
      .set({ status: "cancelled", cancelledAt: new Date() })
      .where(eq(booking.id, bookingId));

    return { ok: true as const };
  });
