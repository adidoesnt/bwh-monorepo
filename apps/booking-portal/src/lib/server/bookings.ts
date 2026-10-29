import { and, eq, lte, sql } from "drizzle-orm";
import {
  booking,
  packagePurchase,
  sessionLedgerEntry,
  type BookingStatus,
} from "@repo/database/schema";
import { zonedDateParts } from "$lib/utils/availability";
import { db } from "./db";
import {
  createBooking,
  getClientActivePackages,
  getCoachSlotsForDate,
  type DbExecutor,
} from "./queries";

/** Serialises everything that reads or changes a coach's bookable time:
 * session requests, approvals and declines, and saving their weekly hours. */
export const lockCoach = (tx: DbExecutor, coachId: string) =>
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
 * ledger entry — moving it out of `pending_approval` is what releases the
 * client's hold. */
export const declineBooking = (bookingId: string, coachId: string) =>
  db.transaction(async (tx) => {
    await lockCoach(tx, coachId);

    const found = await getActionableRequest(tx, bookingId, coachId);
    if (!found.ok) return found;

    await tx
      .update(booking)
      .set({ status: "declined" })
      .where(eq(booking.id, bookingId));

    return { ok: true as const };
  });

/** Marks a session that's already started as completed. Nothing moves on the
 * ledger — the session was spent when the coach approved it. */
export const completeBooking = async (bookingId: string, coachId: string) => {
  const [updated] = await db
    .update(booking)
    .set({ status: "completed" })
    .where(
      and(
        eq(booking.id, bookingId),
        eq(booking.coachId, coachId),
        eq(booking.status, "confirmed"),
        lte(booking.startsAt, new Date()),
      ),
    )
    .returning({ id: booking.id });
  if (updated) return { ok: true as const };

  const [existing] = await db
    .select({ status: booking.status })
    .from(booking)
    .where(and(eq(booking.id, bookingId), eq(booking.coachId, coachId)));

  if (!existing) return { ok: false as const, message: "that session doesn't exist" };
  if (existing.status === "completed") {
    return { ok: false as const, message: "that session is already marked complete" };
  }
  if (existing.status !== "confirmed") {
    return { ok: false as const, message: "only confirmed sessions can be marked complete" };
  }
  return { ok: false as const, message: "that session hasn't started yet" };
};

export const CANCELLATION_WINDOW_HOURS = 24;

export type CancelOutcome = "none" | "return" | "forfeit" | "blocked";

/** What cancelling does to the booking's session — see BOOKING-LIFECYCLE.md. */
export const cancelOutcome = (
  status: BookingStatus,
  startsAt: Date,
  now = Date.now(),
): CancelOutcome => {
  const msUntilStart = startsAt.getTime() - now;
  if (msUntilStart <= 0) return "blocked";
  if (status === "pending_approval") return "none";
  if (status !== "confirmed") return "blocked";
  return msUntilStart >= CANCELLATION_WINDOW_HOURS * 3_600_000 ? "return" : "forfeit";
};

/** Cancels a client's own booking, returning its session when it's far
 * enough out. Status is re-read under the coach lock so a cancel can't
 * interleave with the coach approving the same request. `expectedOutcome` is
 * what the client was shown — if it no longer holds (the 24h window passed,
 * or the coach just approved), refuse rather than surprise them. */
export const cancelBooking = (
  bookingId: string,
  clientId: string,
  expectedOutcome: CancelOutcome,
) =>
  db.transaction(async (tx) => {
    const ownBooking = and(eq(booking.id, bookingId), eq(booking.clientId, clientId));

    const [owned] = await tx
      .select({ coachId: booking.coachId })
      .from(booking)
      .where(ownBooking);
    if (!owned) return { ok: false as const, message: "that booking doesn't exist" };

    await lockCoach(tx, owned.coachId);

    const [current] = await tx
      .select({
        status: booking.status,
        startsAt: booking.startsAt,
        purchaseId: booking.packagePurchaseId,
      })
      .from(booking)
      .where(ownBooking);

    const outcome = cancelOutcome(current.status, current.startsAt);
    if (outcome === "blocked") {
      return { ok: false as const, message: "this session can't be cancelled any more" };
    }
    if (outcome !== expectedOutcome) {
      return {
        ok: false as const,
        message: "this session just changed — check the details before cancelling",
      };
    }

    if (outcome === "return" && current.purchaseId) {
      await tx.insert(sessionLedgerEntry).values({
        clientId,
        purchaseId: current.purchaseId,
        bookingId,
        delta: 1,
        reason: "returned_in_time",
        description: "cancelled in time · session returned",
      });
    }

    await tx
      .update(booking)
      .set({ status: "cancelled", cancelledAt: new Date() })
      .where(eq(booking.id, bookingId));

    return { ok: true as const, outcome };
  });
