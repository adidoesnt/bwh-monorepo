import { and, arrayOverlaps, asc, desc, eq, gt, gte, ilike, inArray, lt, ne, or, sql } from "drizzle-orm";
import {
  booking,
  coachProfile,
  packageOffering,
  packagePurchase,
  sessionLedgerEntry,
  user,
} from "@repo/database/schema";
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

/** A client's non-expired package purchases, each with its remaining balance
 * (summed from `session_ledger_entry`) — the dashboard's package carousel. */
export const getClientActivePackages = async (clientId: string) => {
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
    .where(
      and(
        eq(packagePurchase.clientId, clientId),
        gt(packagePurchase.expiresAt, new Date()),
      ),
    );

  if (purchases.length === 0) return [];

  const balances = await db
    .select({
      purchaseId: sessionLedgerEntry.purchaseId,
      balance: sql<number>`sum(${sessionLedgerEntry.delta})`.mapWith(Number),
    })
    .from(sessionLedgerEntry)
    .where(
      inArray(
        sessionLedgerEntry.purchaseId,
        purchases.map((p) => p.purchaseId),
      ),
    )
    .groupBy(sessionLedgerEntry.purchaseId);

  const balanceByPurchaseId = new Map(balances.map((b) => [b.purchaseId, b.balance]));

  return purchases.map((p) => ({
    ...p,
    balance: balanceByPurchaseId.get(p.purchaseId) ?? 0,
  }));
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