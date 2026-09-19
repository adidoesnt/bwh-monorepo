import {
  and,
  arrayOverlaps,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";
import {
  availabilitySlot,
  booking,
  coachProfile,
  intakeResponse,
  packageOffering,
  packagePurchase,
  sessionLedgerEntry,
  user,
  type SessionType,
} from "@repo/database/schema";
import {
  slotsForDay,
  zonedDateParts,
  zonedTimeToUtc,
  type Slot,
} from "$lib/utils/availability";
import { db } from "./db";

/** The pool or an open transaction — lets a query join a caller's transaction. */
export type DbExecutor =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

/* Client Dashboard Queries */

const UPCOMING_BOOKING_STATUSES = ["pending_approval", "confirmed"] as const;

/** A client's next few sessions, soonest first — the dashboard's "what's next" preview. */
export const getClientUpcomingBookings = async (
  clientId: string,
  limit = 5,
) => {
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

/** Total count behind `getClientUpcomingBookings`, for a "+n more" link when
 * the preview list is truncated. */
export const getClientUpcomingBookingsCount = async (clientId: string) => {
  const [row] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(booking)
    .where(
      and(
        eq(booking.clientId, clientId),
        inArray(booking.status, UPCOMING_BOOKING_STATUSES),
        gt(booking.startsAt, new Date()),
      ),
    );

  return row.count;
};

/** A client's non-expired package purchases, each with its `balance` (summed
 * from `session_ledger_entry`), `holds` (their own other pending_approval
 * bookings against it), and `bookable` (`balance - holds`, what's actually
 * left to request right now) — the dashboard's package carousel uses
 * `balance`, the booking form's package picker uses `bookable`. Pass
 * `coachId` to scope to purchases with one coach, otherwise every coach's
 * purchases come back. */
export const getClientActivePackages = async (
  clientId: string,
  coachId?: string,
  executor: DbExecutor = db,
) => {
  const conditions = [
    eq(packagePurchase.clientId, clientId),
    gt(packagePurchase.expiresAt, new Date()),
  ];
  if (coachId) conditions.push(eq(coachProfile.id, coachId));

  const purchases = await executor
    .select({
      purchaseId: packagePurchase.id,
      packageName: packageOffering.name,
      sessionCount: packageOffering.sessionCount,
      sessionLengthMin: packagePurchase.sessionLengthMin,
      expiresAt: packagePurchase.expiresAt,
      coachId: coachProfile.id,
      coachSlug: coachProfile.slug,
      coachName: user.name,
    })
    .from(packagePurchase)
    .innerJoin(
      packageOffering,
      eq(packagePurchase.packageId, packageOffering.id),
    )
    .innerJoin(coachProfile, eq(packageOffering.coachId, coachProfile.id))
    .innerJoin(user, eq(coachProfile.userId, user.id))
    .where(and(...conditions))
    // Soonest-expiring first — this is the FIFO order a booking draws from
    // when the client doesn't explicitly pick a purchase (see BOOKING-LIFECYCLE.md).
    .orderBy(asc(packagePurchase.expiresAt));

  if (purchases.length === 0) return [];

  const purchaseIds = purchases.map((p) => p.purchaseId);

  const [balances, holds] = await Promise.all([
    executor
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
    executor
      .select({
        purchaseId: booking.packagePurchaseId,
        holds: sql<number>`count(*)`.mapWith(Number),
      })
      .from(booking)
      .where(
        and(
          inArray(booking.packagePurchaseId, purchaseIds),
          eq(booking.status, "pending_approval"),
        ),
      )
      .groupBy(booking.packagePurchaseId),
  ]);

  const balanceByPurchaseId = new Map(
    balances.map((b) => [b.purchaseId, b.balance]),
  );
  const holdsByPurchaseId = new Map(holds.map((h) => [h.purchaseId, h.holds]));

  return purchases.map((p) => {
    const balance = balanceByPurchaseId.get(p.purchaseId) ?? 0;
    const holdsCount = holdsByPurchaseId.get(p.purchaseId) ?? 0;
    return { ...p, balance, holds: holdsCount, bookable: balance - holdsCount };
  });
};

/** Type declaration for return type of `getClientActivePackages` */
export type ActivePackage = Awaited<
  ReturnType<typeof getClientActivePackages>
>[number];
export type PackageSlide = ActivePackage & {
  slideId: string;
  prevId: string;
  nextId: string;
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

/* Type declaration for return type of `getClientRecentActivity` */
export type RecentActivity = Awaited<
  ReturnType<typeof getClientRecentActivity>
>;

/** Every session-ledger entry for a given set of purchases, tagged with
 * `purchaseId` and uncapped — unlike `getClientRecentActivity`'s
 * cross-purchase "last 5" feed, this backs `/packages`' per-package activity
 * dropdown, which needs a specific purchase's full history. Scope
 * `purchaseIds` to what's actually rendered (e.g. `getClientActivePackages`'
 * result) rather than every purchase the client's ever made. */
export const getPurchaseLedgerEntries = async (purchaseIds: string[]) => {
  if (purchaseIds.length === 0) return [];

  return db
    .select({
      id: sessionLedgerEntry.id,
      purchaseId: sessionLedgerEntry.purchaseId,
      delta: sessionLedgerEntry.delta,
      reason: sessionLedgerEntry.reason,
      description: sessionLedgerEntry.description,
      createdAt: sessionLedgerEntry.createdAt,
    })
    .from(sessionLedgerEntry)
    .where(inArray(sessionLedgerEntry.purchaseId, purchaseIds))
    .orderBy(desc(sessionLedgerEntry.createdAt));
};

export type PurchaseLedgerEntries = Awaited<
  ReturnType<typeof getPurchaseLedgerEntries>
>;

/** Total completed sessions for a client, plus the date of the earliest one
 * — the dashboard's "sessions done · since X" stat card. */
export const getClientCompletedSessionStats = async (clientId: string) => {
  const [row] = await db
    .select({
      count: sql<number>`count(*)`.mapWith(Number),
      since: sql<Date | null>`min(${booking.startsAt})`.mapWith((v) =>
        v === null ? null : new Date(v),
      ),
    })
    .from(booking)
    .where(
      and(eq(booking.clientId, clientId), eq(booking.status, "completed")),
    );

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
      return and(
        ne(booking.status, "cancelled"),
        lt(booking.startsAt, new Date()),
      );
    case "awaiting_action":
      return and(
        eq(booking.status, "pending_approval"),
        gte(booking.startsAt, new Date()),
      );
    case "upcoming":
      return and(
        eq(booking.status, "confirmed"),
        gte(booking.startsAt, new Date()),
      );
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
      upcoming:
        sql<number>`count(*) filter (where ${booking.status} = 'confirmed' and ${booking.startsAt} >= now())`.mapWith(
          Number,
        ),
      awaitingAction:
        sql<number>`count(*) filter (where ${booking.status} = 'pending_approval' and ${booking.startsAt} >= now())`.mapWith(
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
    .leftJoin(
      cheapestPackagePrice,
      eq(cheapestPackagePrice.coachId, coachProfile.id),
    )
    .where(and(...conditions))
    .orderBy(
      ...(sort === "price"
        ? [
            sql`${cheapestPackagePrice.priceCents} asc nulls last`,
            asc(user.name),
          ]
        : [asc(user.name)]),
    )
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    coaches: rows.map(({ totalCount: _totalCount, ...coach }) => coach),
    totalCount: rows[0]?.totalCount ?? 0,
  };
};

const COACH_DIRECTORY_SORTS: CoachDirectorySort[] = ["name", "price"];

/** Parses `?q=&tags=&sort=&page=&pageSize=` into `getCoachDirectoryPage`'s
 * params — shared by `/bookings` and `/packages`, which both browse the same
 * coach directory. */
export const parseCoachDirectoryParams = (url: URL): CoachDirectoryParams => {
  const sort = url.searchParams.get("sort");
  const page = Number(url.searchParams.get("page"));
  const pageSize = Number(url.searchParams.get("pageSize"));
  const tags = url.searchParams.get("tags");

  return {
    search: url.searchParams.get("q") ?? undefined,
    tags: tags ? tags.split(",").filter(Boolean) : undefined,
    sort: COACH_DIRECTORY_SORTS.includes(sort as CoachDirectorySort)
      ? (sort as CoachDirectorySort)
      : undefined,
    page: Number.isInteger(page) && page > 0 ? page : undefined,
    pageSize: Number.isInteger(pageSize) && pageSize > 0 ? pageSize : undefined,
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
export const getCoachAvailabilitySlots = async (
  coachId: string,
  executor: DbExecutor = db,
) => {
  return executor
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
export const getCoachActiveBookings = async (
  coachId: string,
  from: Date,
  to: Date,
  executor: DbExecutor = db,
) => {
  return executor
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
export const getCoachSlots = async (
  {
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
  },
  executor: DbExecutor = db,
) => {
  const [availabilitySlots, existingBookings] = await Promise.all([
    getCoachAvailabilitySlots(coachId, executor),
    getCoachActiveBookings(coachId, from, to, executor),
  ]);

  const windowsByWeekday = new Map<
    number,
    { startMin: number; endMin: number }[]
  >();
  for (const s of availabilitySlots) {
    const windows = windowsByWeekday.get(s.weekday) ?? [];
    windows.push({ startMin: s.startMin, endMin: s.endMin });
    windowsByWeekday.set(s.weekday, windows);
  }

  const slots: Slot[] = [];
  for (
    let cursor = new Date(from);
    cursor < to;
    cursor = new Date(cursor.getTime() + 86_400_000)
  ) {
    const { year, month, day, weekday } = zonedDateParts(cursor, zone);
    const windows = windowsByWeekday.get(weekday) ?? [];
    if (windows.length === 0) continue;

    slots.push(
      ...slotsForDay({
        year,
        month,
        day,
        zone,
        windows,
        existingBookings,
        durationMin,
      }),
    );
  }

  return slots;
};

/** Convenience wrapper around `getCoachSlots` for a single coach-local
 * calendar day, given `zonedDateParts`-shaped `date`. */
export const getCoachSlotsForDate = async (
  {
    coachId,
    zone,
    date,
    durationMin,
  }: {
    coachId: string;
    zone: string;
    date: { year: number; month: number; day: number };
    durationMin: number;
  },
  executor: DbExecutor = db,
) => {
  const dayStart = zonedTimeToUtc(date.year, date.month, date.day, 0, 0, zone);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  return getCoachSlots(
    {
      coachId,
      zone,
      from: dayStart,
      to: dayEnd,
      durationMin,
    },
    executor,
  );
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
    .where(
      and(
        eq(packageOffering.coachId, coachId),
        eq(packageOffering.active, true),
      ),
    )
    .orderBy(asc(packageOffering.pricePerSessionCents));
};

/** One of a coach's active packages by id, or `null` if it doesn't exist /
 * isn't active / belongs to a different coach — used to revalidate a
 * `?/buy` request against the coach page it came from. */
export const getCoachPackageById = async (coachId: string, packageId: string) => {
  const [row] = await db
    .select({
      id: packageOffering.id,
      name: packageOffering.name,
      sessionCount: packageOffering.sessionCount,
      sessionLengthMin: packageOffering.sessionLengthMin,
      pricePerSessionCents: packageOffering.pricePerSessionCents,
      validityDays: packageOffering.validityDays,
    })
    .from(packageOffering)
    .where(
      and(
        eq(packageOffering.id, packageId),
        eq(packageOffering.coachId, coachId),
        eq(packageOffering.active, true),
      ),
    )
    .limit(1);

  return row ?? null;
};

export type SuggestedPackage = Awaited<
  ReturnType<typeof getSuggestedPackages>
>[number];

/** Up to `limit` packages to suggest buying, for `/packages`'s "purchase a
 * package" panel. If the client has any booking/purchase history, suggests
 * one package (the cheapest active one) per distinct coach they've most
 * recently been active with. A brand-new client with no history instead
 * gets the platform's most-purchased active packages, preferring the
 * client's own timezone as a tiebreaker when it's known. Location isn't
 * factored in — clients don't have a stored location to match against. */
export const getSuggestedPackages = async (
  clientId: string,
  clientZone: string | null,
  limit = 3,
) => {
  const [bookingActivity, purchaseActivity] = await Promise.all([
    db
      .select({
        coachId: booking.coachId,
        lastActivity: sql<Date>`max(${booking.createdAt})`.mapWith(
          (v) => new Date(v),
        ),
      })
      .from(booking)
      .where(eq(booking.clientId, clientId))
      .groupBy(booking.coachId),
    db
      .select({
        coachId: packageOffering.coachId,
        lastActivity: sql<Date>`max(${packagePurchase.purchasedAt})`.mapWith(
          (v) => new Date(v),
        ),
      })
      .from(packagePurchase)
      .innerJoin(
        packageOffering,
        eq(packagePurchase.packageId, packageOffering.id),
      )
      .where(eq(packagePurchase.clientId, clientId))
      .groupBy(packageOffering.coachId),
  ]);

  const lastActivityByCoachId = new Map<string, Date>();
  for (const { coachId, lastActivity } of [
    ...bookingActivity,
    ...purchaseActivity,
  ]) {
    const existing = lastActivityByCoachId.get(coachId);
    if (!existing || lastActivity > existing) {
      lastActivityByCoachId.set(coachId, lastActivity);
    }
  }

  const recentCoachIds = [...lastActivityByCoachId.entries()]
    .sort(([, a], [, b]) => b.getTime() - a.getTime())
    .slice(0, limit)
    .map(([coachId]) => coachId);

  const packageColumns = {
    packageId: packageOffering.id,
    coachId: coachProfile.id,
    coachSlug: coachProfile.slug,
    coachName: user.name,
    name: packageOffering.name,
    description: packageOffering.description,
    sessionCount: packageOffering.sessionCount,
    sessionLengthMin: packageOffering.sessionLengthMin,
    pricePerSessionCents: packageOffering.pricePerSessionCents,
    validityDays: packageOffering.validityDays,
  };

  if (recentCoachIds.length > 0) {
    const rows = await db
      .select(packageColumns)
      .from(packageOffering)
      .innerJoin(coachProfile, eq(packageOffering.coachId, coachProfile.id))
      .innerJoin(user, eq(coachProfile.userId, user.id))
      .where(
        and(
          inArray(packageOffering.coachId, recentCoachIds),
          eq(packageOffering.active, true),
        ),
      )
      .orderBy(asc(packageOffering.pricePerSessionCents));

    const cheapestByCoachId = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (!cheapestByCoachId.has(row.coachId)) {
        cheapestByCoachId.set(row.coachId, row);
      }
    }

    return recentCoachIds
      .map((coachId) => cheapestByCoachId.get(coachId))
      .filter((row): row is (typeof rows)[number] => row !== undefined)
      .map((row) => ({ ...row, reason: "recent" as const }));
  }

  const purchaseCounts = db
    .select({
      packageId: packagePurchase.packageId,
      totalSessionsSold: sql<number>`sum(${packagePurchase.sessionsGranted})`
        .mapWith(Number)
        .as("total_sessions_sold"),
    })
    .from(packagePurchase)
    .groupBy(packagePurchase.packageId)
    .as("purchase_counts");

  const popularity = sql`coalesce(${purchaseCounts.totalSessionsSold}, 0)`;

  const popularRows = await db
    .select(packageColumns)
    .from(packageOffering)
    .innerJoin(coachProfile, eq(packageOffering.coachId, coachProfile.id))
    .innerJoin(user, eq(coachProfile.userId, user.id))
    .leftJoin(purchaseCounts, eq(purchaseCounts.packageId, packageOffering.id))
    .where(eq(packageOffering.active, true))
    .orderBy(
      desc(sql`${coachProfile.timezone} = ${clientZone ?? ""}`),
      desc(popularity),
      asc(packageOffering.pricePerSessionCents),
    )
    .limit(limit);

  return popularRows.map((row) => ({ ...row, reason: "popular" as const }));
};

/** How many non-expired purchases a client holds — same definition of
 * "active" as `getClientActivePackages`, without its balance/holds work. */
export const getClientActivePackageCount = async (
  clientId: string,
  executor: DbExecutor = db,
) => {
  const [row] = await executor
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(packagePurchase)
    .where(
      and(
        eq(packagePurchase.clientId, clientId),
        gt(packagePurchase.expiresAt, new Date()),
      ),
    );

  return row.count;
};

/** Buys a package: creates the purchase (snapshotting price/length/expiry
 * off the offering) and immediately grants its sessions via a `purchase`
 * ledger entry. No payment processor is wired up yet (see ROADMAP.md
 * Phase 4) — sessions land as soon as the purchase row does. */
export const purchasePackage = async (
  values: {
    clientId: string;
    pkg: {
      id: string;
      name: string;
      sessionCount: number;
      sessionLengthMin: number;
      pricePerSessionCents: number;
      validityDays: number;
    };
  },
  executor: DbExecutor = db,
) => {
  const { clientId, pkg } = values;
  const purchasedAt = new Date();
  const expiresAt = new Date(
    purchasedAt.getTime() + pkg.validityDays * 86_400_000,
  );

  // One transaction (a savepoint if the caller already opened one) so a
  // failure between the inserts can't leave a purchase with no `purchase`
  // ledger entry, i.e. a paid-for package with 0 balance.
  return executor.transaction(async (tx) => {
    const [purchase] = await tx
      .insert(packagePurchase)
      .values({
        clientId,
        packageId: pkg.id,
        purchasedAt,
        pricePaidCents: pkg.sessionCount * pkg.pricePerSessionCents,
        sessionsGranted: pkg.sessionCount,
        sessionLengthMin: pkg.sessionLengthMin,
        expiresAt,
      })
      .returning({ id: packagePurchase.id });

    await tx.insert(sessionLedgerEntry).values({
      clientId,
      purchaseId: purchase.id,
      delta: pkg.sessionCount,
      reason: "purchase",
      description: `purchased ${pkg.name}`,
    });

    return purchase;
  });
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

/** Inserts a `pending_approval` booking. No ledger entry here — the session
 * is only spent when a coach approves (see `BOOKING-LIFECYCLE.md`). */
export const createBooking = async (
  values: {
    clientId: string;
    coachId: string;
    type: SessionType;
    location: string;
    startsAt: Date;
    durationMin: number;
    packagePurchaseId: string | null;
    clientNote: string | null;
  },
  executor: DbExecutor = db,
) => {
  const [row] = await executor
    .insert(booking)
    .values({ ...values, status: "pending_approval" })
    .returning({ id: booking.id });

  return row;
};
