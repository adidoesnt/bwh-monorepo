import { and, arrayOverlaps, asc, desc, eq, gt, gte, ilike, inArray, lt, ne, or, sql } from "drizzle-orm";
import {
  availabilitySlot,
  booking,
  coachProfile,
  intakeResponse,
  packageOffering,
  packagePurchase,
  sessionLedgerEntry,
  user,
} from "@repo/database/schema";
import { slotsForDay, zonedDateParts, zonedTimeToUtc, type Slot } from "$lib/utils/availability";
import { db } from "./db";

/* Client Dashboard Queries */

const UPCOMING_BOOKING_STATUSES = ["pending_approval", "confirmed"] as const;

/** A client's next few sessions, soonest first — the dashboard's "what's next" preview. */
export const getClientUpcomingBookings = async (clientId: string, limit = 5) => {
  return db
    .select({
      id: booking.id,
      type: booking.type,
      location: booking.location,
      startsAt: booking.startsAt,
      durationMin: booking.durationMin,
      status: booking.status,
      coachName: user.name,
    })
    .from(booking)
    .innerJoin(coachProfile, eq(booking.coachId, coachProfile.id))
    .innerJoin(user, eq(coachProfile.userId, user.id))
    .where(
      and(
        eq(booking.clientId, clientId),
        inArray(booking.status, UPCOMING_BOOKING_STATUSES),
        gt(booking.startsAt, new Date()),
      ),
    )
    .orderBy(asc(booking.startsAt))
    .limit(limit);
};

/** A client's non-expired package purchases, each with its `balance` (summed
 * from `session_ledger_entry`), `holds` (their own other pending_approval
 * bookings against it), and `bookable` (`balance - holds`, what's actually
 * left to request right now) — the dashboard's package carousel uses
 * `balance`, the booking form's package picker uses `bookable`. Pass
 * `coachId` to scope to purchases with one coach, otherwise every coach's
 * purchases come back. */
export const getClientActivePackages = async (clientId: string, coachId?: string) => {
  const conditions = [
    eq(packagePurchase.clientId, clientId),
    gt(packagePurchase.expiresAt, new Date()),
  ];
  if (coachId) conditions.push(eq(coachProfile.id, coachId));

  const purchases = await db
    .select({
      purchaseId: packagePurchase.id,
      packageName: packageOffering.name,
      sessionCount: packageOffering.sessionCount,
      sessionLengthMin: packagePurchase.sessionLengthMin,
      expiresAt: packagePurchase.expiresAt,
      coachId: coachProfile.id,
      coachName: user.name,
    })
    .from(packagePurchase)
    .innerJoin(packageOffering, eq(packagePurchase.packageId, packageOffering.id))
    .innerJoin(coachProfile, eq(packageOffering.coachId, coachProfile.id))
    .innerJoin(user, eq(coachProfile.userId, user.id))
    .where(and(...conditions));

  if (purchases.length === 0) return [];

  const purchaseIds = purchases.map((p) => p.purchaseId);

  const [balances, holds] = await Promise.all([
    db
      .select({
        purchaseId: sessionLedgerEntry.purchaseId,
        balance: sql<number>`sum(${sessionLedgerEntry.delta})`.mapWith(Number),
      })
      .from(sessionLedgerEntry)
      .where(inArray(sessionLedgerEntry.purchaseId, purchaseIds))
      .groupBy(sessionLedgerEntry.purchaseId),
    // "Holds" — the client's own other pending_approval bookings against a
    // purchase. Not yet consumed (the ledger only moves on approval), but
    // already spoken for, so they come off what's actually bookable now.
    db
      .select({
        purchaseId: booking.packagePurchaseId,
        holds: sql<number>`count(*)`.mapWith(Number),
      })
      .from(booking)
      .where(
        and(inArray(booking.packagePurchaseId, purchaseIds), eq(booking.status, "pending_approval")),
      )
      .groupBy(booking.packagePurchaseId),
  ]);

  const balanceByPurchaseId = new Map(balances.map((b) => [b.purchaseId, b.balance]));
  const holdsByPurchaseId = new Map(holds.map((h) => [h.purchaseId, h.holds]));

  return purchases.map((p) => {
    const balance = balanceByPurchaseId.get(p.purchaseId) ?? 0;
    const holdsCount = holdsByPurchaseId.get(p.purchaseId) ?? 0;
    return { ...p, balance, holds: holdsCount, bookable: balance - holdsCount };
  });
};

/** A client's most recent session-ledger movements — the dashboard's activity feed. */
export const getClientRecentActivity = async (clientId: string, limit = 5) => {
  return db
    .select({
      id: sessionLedgerEntry.id,
      delta: sessionLedgerEntry.delta,
      reason: sessionLedgerEntry.reason,
      description: sessionLedgerEntry.description,
      createdAt: sessionLedgerEntry.createdAt,
    })
    .from(sessionLedgerEntry)
    .where(eq(sessionLedgerEntry.clientId, clientId))
    .orderBy(desc(sessionLedgerEntry.createdAt))
    .limit(limit);
};

/** Total completed sessions for a client, plus the date of the earliest one
 * — the dashboard's "sessions done · since X" stat card. */
export const getClientCompletedSessionStats = async (clientId: string) => {
  const [row] = await db
    .select({
      count: sql<number>`count(*)`.mapWith(Number),
      since: sql<Date | null>`min(${booking.startsAt})`.mapWith((v) => (v === null ? null : new Date(v))),
    })
    .from(booking)
    .where(and(eq(booking.clientId, clientId), eq(booking.status, "completed")));

  return row;
};

/** Monday 00:00 UTC of the week `weeksAgo` weeks before `date`. */
const startOfWeek = (date: Date, weeksAgo = 0) => {
  const start = new Date(date);
  const daysSinceMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceMonday - weeksAgo * 7);
  start.setUTCHours(0, 0, 0, 0);
  return start;
};

/** Completed-session counts for the current and prior week (Monday–Sunday, UTC)
 * — the dashboard's "this week · N more/fewer than last week" stat card. */
export const getClientWeeklySessionCounts = async (clientId: string) => {
  const now = new Date();
  const thisWeekStart = startOfWeek(now, 0);
  const lastWeekStart = startOfWeek(now, 1);

  const rows = await db
    .select({ startsAt: booking.startsAt })
    .from(booking)
    .where(
      and(
        eq(booking.clientId, clientId),
        eq(booking.status, "completed"),
        gte(booking.startsAt, lastWeekStart),
      ),
    );

  const thisWeek = rows.filter((r) => r.startsAt >= thisWeekStart).length;
  const lastWeek = rows.length - thisWeek;

  return { thisWeek, lastWeek };
};

/* Client Bookings Page Queries */

export type BookingBucket = "upcoming" | "awaiting_action" | "past";

/** Date-first, status-second bucketing — see BOOKING-LIFECYCLE.md. */
const bucketCondition = (bucket: BookingBucket) => {
  switch (bucket) {
    case "past":
      return and(ne(booking.status, "cancelled"), lt(booking.startsAt, new Date()));
    case "awaiting_action":
      return and(eq(booking.status, "pending_approval"), gte(booking.startsAt, new Date()));
    case "upcoming":
      return and(eq(booking.status, "confirmed"), gte(booking.startsAt, new Date()));
  }
};

/** One page of a client's bookings within a single tab bucket. `past` sorts
 * most-recent-first; `upcoming` / `awaiting_action` sort soonest-first. */
export const getClientBookingsPage = async ({
  clientId,
  bucket,
  page = 1,
  pageSize = 10,
}: {
  clientId: string;
  bucket: BookingBucket;
  page?: number;
  pageSize?: number;
}) => {
  const rows = await db
    .select({
      id: booking.id,
      type: booking.type,
      location: booking.location,
      startsAt: booking.startsAt,
      durationMin: booking.durationMin,
      status: booking.status,
      coachName: user.name,
      totalCount: sql<number>`count(*) over()`.mapWith(Number),
    })
    .from(booking)
    .innerJoin(coachProfile, eq(booking.coachId, coachProfile.id))
    .innerJoin(user, eq(coachProfile.userId, user.id))
    .where(and(eq(booking.clientId, clientId), bucketCondition(bucket)))
    .orderBy(bucket === "past" ? desc(booking.startsAt) : asc(booking.startsAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    bookings: rows.map(({ totalCount: _totalCount, ...b }) => b),
    totalCount: rows[0]?.totalCount ?? 0,
  };
};

/** Counts per tab bucket, for the tab labels (e.g. "awaiting action (2)") —
 * can't be derived from `getClientBookingsPage` since that only ever holds
 * one bucket's page at a time. */
export const getClientBookingBucketCounts = async (clientId: string) => {
  const [row] = await db
    .select({
      upcoming: sql<number>`count(*) filter (where ${booking.status} = 'confirmed' and ${booking.startsAt} >= now())`.mapWith(
        Number,
      ),
      awaitingAction: sql<number>`count(*) filter (where ${booking.status} = 'pending_approval' and ${booking.startsAt} >= now())`.mapWith(
        Number,
      ),
      past: sql<number>`count(*) filter (where ${booking.status} <> 'cancelled' and ${booking.startsAt} < now())`.mapWith(
        Number,
      ),
    })
    .from(booking)
    .where(eq(booking.clientId, clientId));

  return row;
};

/** Count for the `bookings` nav badge — non-cancelled bookings that aren't in
 * the past, i.e. everything that'd land in "upcoming" or "awaiting action". */
export const getClientActionableBookingCount = async (clientId: string) => {
  const [row] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(booking)
    .where(
      and(
        eq(booking.clientId, clientId),
        ne(booking.status, "cancelled"),
        gte(booking.startsAt, new Date()),
      ),
    );

  return row.count;
};

export type CoachDirectorySort = "name" | "price";

export type CoachDirectoryParams = {
  search?: string;
  tags?: string[];
  sort?: CoachDirectorySort;
  page?: number;
  pageSize?: number;
};

/** Cheapest active package per coach, for the price sort/display. */
const cheapestPackagePrice = db
  .select({
    coachId: packageOffering.coachId,
    priceCents: sql<number>`min(${packageOffering.pricePerSessionCents})`
      .mapWith(Number)
      .as("price_cents"),
  })
  .from(packageOffering)
  .where(eq(packageOffering.active, true))
  .groupBy(packageOffering.coachId)
  .as("cheapest_package_price");

/** Server-side paginated, searchable, tag-filterable coach directory.
 * `soonest` / `most open slots` sorts aren't offered yet — they need real
 * availability computed in a way that's still sortable/paginated at the DB
 * level (see ROADMAP.md Phase 3). */
export const getCoachDirectoryPage = async ({
  search,
  tags,
  sort = "name",
  page = 1,
  pageSize = 10,
}: CoachDirectoryParams) => {
  const conditions = [eq(coachProfile.active, true)];

  if (search) {
    const term = `%${search}%`;
    conditions.push(
      or(
        ilike(user.name, term),
        ilike(coachProfile.speciality, term),
        ilike(coachProfile.tagline, term),
      )!,
    );
  }

  if (tags && tags.length > 0) {
    conditions.push(arrayOverlaps(coachProfile.tags, tags));
  }

  const rows = await db
    .select({
      id: coachProfile.id,
      slug: coachProfile.slug,
      name: user.name,
      speciality: coachProfile.speciality,
      tagline: coachProfile.tagline,
      tags: coachProfile.tags,
      locations: coachProfile.locations,
      cheapestPriceCents: cheapestPackagePrice.priceCents,
      totalCount: sql<number>`count(*) over()`.mapWith(Number),
    })
    .from(coachProfile)
    .innerJoin(user, eq(coachProfile.userId, user.id))
    .leftJoin(cheapestPackagePrice, eq(cheapestPackagePrice.coachId, coachProfile.id))
    .where(and(...conditions))
    .orderBy(
      ...(sort === "price"
        ? [sql`${cheapestPackagePrice.priceCents} asc nulls last`, asc(user.name)]
        : [asc(user.name)]),
    )
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    coaches: rows.map(({ totalCount: _totalCount, ...coach }) => coach),
    totalCount: rows[0]?.totalCount ?? 0,
  };
};

/** Every distinct tag across active coaches, for the directory's filter chips. */
export const getAllCoachTags = async () => {
  const rows = await db
    .select({ tag: sql<string>`unnest(${coachProfile.tags})` })
    .from(coachProfile)
    .where(eq(coachProfile.active, true))
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  return rows.map((r) => r.tag);
};

/* Availability */

/** A coach's recurring weekly open windows, every weekday. */
export const getCoachAvailabilitySlots = async (coachId: string) => {
  return db
    .select({
      weekday: availabilitySlot.weekday,
      startMin: availabilitySlot.startMin,
      endMin: availabilitySlot.endMin,
    })
    .from(availabilitySlot)
    .where(eq(availabilitySlot.coachId, coachId));
};

/** A coach's non-cancelled, non-completed bookings starting in `[from, to)` —
 * the sessions that occupy a calendar slot and block others from being offered. */
export const getCoachActiveBookings = async (coachId: string, from: Date, to: Date) => {
  return db
    .select({ startsAt: booking.startsAt, durationMin: booking.durationMin })
    .from(booking)
    .where(
      and(
        eq(booking.coachId, coachId),
        inArray(booking.status, UPCOMING_BOOKING_STATUSES),
        gte(booking.startsAt, from),
        lt(booking.startsAt, to),
      ),
    );
};

/** Every candidate slot for a coach across `[from, to)`, at `durationMin`
 * each, tagged `available` — combines their weekly windows with their
 * existing bookings in range, then walks each coach-local calendar day
 * applying `slotsForDay`. */
export const getCoachSlots = async ({
  coachId,
  zone,
  from,
  to,
  durationMin,
}: {
  coachId: string;
  zone: string;
  from: Date;
  to: Date;
  durationMin: number;
}) => {
  const [availabilitySlots, existingBookings] = await Promise.all([
    getCoachAvailabilitySlots(coachId),
    getCoachActiveBookings(coachId, from, to),
  ]);

  const windowsByWeekday = new Map<number, { startMin: number; endMin: number }[]>();
  for (const s of availabilitySlots) {
    const windows = windowsByWeekday.get(s.weekday) ?? [];
    windows.push({ startMin: s.startMin, endMin: s.endMin });
    windowsByWeekday.set(s.weekday, windows);
  }

  const slots: Slot[] = [];
  for (let cursor = new Date(from); cursor < to; cursor = new Date(cursor.getTime() + 86_400_000)) {
    const { year, month, day, weekday } = zonedDateParts(cursor, zone);
    const windows = windowsByWeekday.get(weekday) ?? [];
    if (windows.length === 0) continue;

    slots.push(...slotsForDay({ year, month, day, zone, windows, existingBookings, durationMin }));
  }

  return slots;
};

/** Convenience wrapper around `getCoachSlots` for a single coach-local
 * calendar day, given `zonedDateParts`-shaped `date`. */
export const getCoachSlotsForDate = async ({
  coachId,
  zone,
  date,
  durationMin,
}: {
  coachId: string;
  zone: string;
  date: { year: number; month: number; day: number };
  durationMin: number;
}) => {
  const dayStart = zonedTimeToUtc(date.year, date.month, date.day, 0, 0, zone);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  return getCoachSlots({ coachId, zone, from: dayStart, to: dayEnd, durationMin });
};

/* Coach Profile Page Queries */

/** An active coach's profile fields by slug, or `null` if no such active coach exists. */
export const getCoachBySlug = async (slug: string) => {
  const [coach] = await db
    .select({
      id: coachProfile.id,
      slug: coachProfile.slug,
      name: user.name,
      speciality: coachProfile.speciality,
      tagline: coachProfile.tagline,
      bio: coachProfile.bio,
      tags: coachProfile.tags,
      locations: coachProfile.locations,
      timezone: coachProfile.timezone,
    })
    .from(coachProfile)
    .innerJoin(user, eq(coachProfile.userId, user.id))
    .where(and(eq(coachProfile.slug, slug), eq(coachProfile.active, true)))
    .limit(1);

  return coach ?? null;
};

/** A coach's active packages, cheapest first. */
export const getCoachPackages = async (coachId: string) => {
  return db
    .select({
      id: packageOffering.id,
      name: packageOffering.name,
      description: packageOffering.description,
      sessionCount: packageOffering.sessionCount,
      sessionLengthMin: packageOffering.sessionLengthMin,
      pricePerSessionCents: packageOffering.pricePerSessionCents,
      validityDays: packageOffering.validityDays,
    })
    .from(packageOffering)
    .where(and(eq(packageOffering.coachId, coachId), eq(packageOffering.active, true)))
    .orderBy(asc(packageOffering.pricePerSessionCents));
};

/** A coach's distinct weekly windows, deduplicated across weekdays — the
 * profile page's "open hours" summary chips, not tied to any specific date. */
export const getCoachOpenHours = async (coachId: string) => {
  return db
    .selectDistinct({
      startMin: availabilitySlot.startMin,
      endMin: availabilitySlot.endMin,
    })
    .from(availabilitySlot)
    .where(eq(availabilitySlot.coachId, coachId))
    .orderBy(asc(availabilitySlot.startMin));
};

/** Whether a client has completed PAR-Q health screening — gates the booking
 * form to `free consult` only until they have. */
export const getClientIntakeSubmitted = async (clientId: string) => {
  const [row] = await db
    .select({ submittedAt: intakeResponse.submittedAt })
    .from(intakeResponse)
    .where(eq(intakeResponse.clientId, clientId))
    .limit(1);

  return row?.submittedAt != null;
};