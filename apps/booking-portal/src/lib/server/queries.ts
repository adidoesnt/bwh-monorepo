import { and, desc, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import {
  availabilitySlot,
  booking,
  coachProfile,
  creditLedgerEntry,
  intakeResponse,
  packageOffering,
  packagePurchase,
  user,
  type BookingStatus,
  type SessionType,
} from "@repo/database/schema";
import { db } from "./db";

/** Booking statuses that occupy a slot on the coach's calendar. */
const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  "pending_approval",
  "pending_payment",
  "confirmed",
];

/** Monday 00:00 through the following Monday 00:00 for the week containing `ref`. */
function weekBounds(ref: Date) {
  const start = new Date(ref);
  start.setHours(0, 0, 0, 0);
  // getDay(): 0 = Sunday. Shift so Monday is the first day.
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

export type UpcomingBooking = {
  id: string;
  type: SessionType;
  startsAt: Date;
  location: string;
  status: BookingStatus;
  coachName: string;
};

export type ClientDashboard = {
  creditBalance: number;
  activePackage: {
    name: string;
    creditsGranted: number;
    creditsLeft: number;
    creditsUsed: number;
    expiresAt: Date;
  } | null;
  upcoming: UpcomingBooking[];
  stats: {
    nextSessionAt: Date | null;
    sessionsDone: number;
    thisWeek: number;
  };
  intakeComplete: boolean;
  /** Bookings needing the client to act (pay / awaiting approval). */
  actionNeeded: number;
};

export async function getCreditBalance(clientId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${creditLedgerEntry.delta}), 0)` })
    .from(creditLedgerEntry)
    .where(eq(creditLedgerEntry.clientId, clientId));
  return Number(row?.total ?? 0);
}

/** The client's most recent still-valid package purchase, or null. */
export async function getActivePackage(clientId: string) {
  const [row] = await db
    .select({
      name: packageOffering.name,
      creditsGranted: packagePurchase.creditsGranted,
      expiresAt: packagePurchase.expiresAt,
    })
    .from(packagePurchase)
    .innerJoin(
      packageOffering,
      eq(packageOffering.id, packagePurchase.packageId),
    )
    .where(
      and(
        eq(packagePurchase.clientId, clientId),
        gte(packagePurchase.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(packagePurchase.purchasedAt))
    .limit(1);
  return row ?? null;
}

async function activePackage(clientId: string, balance: number) {
  const row = await getActivePackage(clientId);
  if (!row) return null;
  const creditsLeft = Math.max(0, Math.min(balance, row.creditsGranted));
  return {
    name: row.name,
    creditsGranted: row.creditsGranted,
    creditsLeft,
    creditsUsed: row.creditsGranted - creditsLeft,
    expiresAt: row.expiresAt,
  };
}

async function upcomingBookings(
  clientId: string,
  limit: number,
): Promise<UpcomingBooking[]> {
  const rows = await db
    .select({
      id: booking.id,
      type: booking.type,
      startsAt: booking.startsAt,
      location: booking.location,
      status: booking.status,
      coachName: user.name,
    })
    .from(booking)
    .innerJoin(coachProfile, eq(coachProfile.id, booking.coachId))
    .innerJoin(user, eq(user.id, coachProfile.userId))
    .where(
      and(
        eq(booking.clientId, clientId),
        gte(booking.startsAt, new Date()),
        ne(booking.status, "cancelled"),
      ),
    )
    .orderBy(booking.startsAt)
    .limit(limit);
  return rows;
}

/** Whether the client has submitted their PAR-Q screening. */
export async function getIntakeComplete(clientId: string): Promise<boolean> {
  const [row] = await db
    .select({ submittedAt: intakeResponse.submittedAt })
    .from(intakeResponse)
    .where(eq(intakeResponse.clientId, clientId))
    .limit(1);
  return Boolean(row?.submittedAt);
}

/** Just the figures the sidebar badges need — cheaper than the full dashboard. */
export async function getClientNavBadges(clientId: string) {
  const [balance, actionRow, intakeRow] = await Promise.all([
    getCreditBalance(clientId),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(booking)
      .where(
        and(
          eq(booking.clientId, clientId),
          inArray(booking.status, ["pending_payment", "pending_approval"]),
        ),
      ),
    db
      .select({ submittedAt: intakeResponse.submittedAt })
      .from(intakeResponse)
      .where(eq(intakeResponse.clientId, clientId))
      .limit(1),
  ]);

  return {
    creditBalance: balance,
    actionNeeded: actionRow[0]?.n ?? 0,
    intakeComplete: Boolean(intakeRow[0]?.submittedAt),
  };
}

export async function getClientDashboard(
  clientId: string,
): Promise<ClientDashboard> {
  const balance = await getCreditBalance(clientId);
  const { start, end } = weekBounds(new Date());

  const [pkg, upcoming, doneRow, weekRow, intakeRow, actionRow] =
    await Promise.all([
      activePackage(clientId, balance),
      upcomingBookings(clientId, 3),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(booking)
        .where(
          and(
            eq(booking.clientId, clientId),
            eq(booking.status, "completed"),
          ),
        ),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(booking)
        .where(
          and(
            eq(booking.clientId, clientId),
            inArray(booking.status, ["confirmed", "completed"]),
            gte(booking.startsAt, start),
            lt(booking.startsAt, end),
          ),
        ),
      db
        .select({ submittedAt: intakeResponse.submittedAt })
        .from(intakeResponse)
        .where(eq(intakeResponse.clientId, clientId))
        .limit(1),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(booking)
        .where(
          and(
            eq(booking.clientId, clientId),
            inArray(booking.status, ["pending_payment", "pending_approval"]),
          ),
        ),
    ]);

  return {
    creditBalance: balance,
    activePackage: pkg,
    upcoming,
    stats: {
      nextSessionAt: upcoming[0]?.startsAt ?? null,
      sessionsDone: doneRow[0]?.n ?? 0,
      thisWeek: weekRow[0]?.n ?? 0,
    },
    intakeComplete: Boolean(intakeRow[0]?.submittedAt),
    actionNeeded: actionRow[0]?.n ?? 0,
  };
}

// ─── Coach directory & booking ──────────────────────────────────────────────

const coachColumns = {
  id: coachProfile.id,
  slug: coachProfile.slug,
  name: user.name,
  speciality: coachProfile.speciality,
  tagline: coachProfile.tagline,
  bio: coachProfile.bio,
  tags: coachProfile.tags,
  rateFromCents: coachProfile.rateFromCents,
  locations: coachProfile.locations,
  timezone: coachProfile.timezone,
  coachingSince: coachProfile.coachingSince,
};

export type CoachRow = {
  id: string;
  slug: string;
  name: string;
  speciality: string;
  tagline: string;
  bio: string;
  tags: string[];
  rateFromCents: number;
  locations: string[];
  timezone: string;
  coachingSince: number | null;
};

export async function listActiveCoaches(): Promise<CoachRow[]> {
  return db
    .select(coachColumns)
    .from(coachProfile)
    .innerJoin(user, eq(user.id, coachProfile.userId))
    .where(eq(coachProfile.active, true))
    .orderBy(user.name);
}

export async function getCoachBySlug(slug: string): Promise<CoachRow | null> {
  const [row] = await db
    .select(coachColumns)
    .from(coachProfile)
    .innerJoin(user, eq(user.id, coachProfile.userId))
    .where(and(eq(coachProfile.slug, slug), eq(coachProfile.active, true)))
    .limit(1);
  return row ?? null;
}

export type AvailabilityInputs = {
  windows: {
    coachId: string;
    weekday: number;
    startMin: number;
    endMin: number;
  }[];
  busy: { coachId: string; startsAt: Date; durationMin: number }[];
};

/** Weekly windows + slot-occupying bookings for one or more coaches. */
export async function coachAvailabilityInputs(
  coachIds: string[],
): Promise<AvailabilityInputs> {
  if (coachIds.length === 0) return { windows: [], busy: [] };
  const [windows, busy] = await Promise.all([
    db
      .select({
        coachId: availabilitySlot.coachId,
        weekday: availabilitySlot.weekday,
        startMin: availabilitySlot.startMin,
        endMin: availabilitySlot.endMin,
      })
      .from(availabilitySlot)
      .where(inArray(availabilitySlot.coachId, coachIds)),
    db
      .select({
        coachId: booking.coachId,
        startsAt: booking.startsAt,
        durationMin: booking.durationMin,
      })
      .from(booking)
      .where(
        and(
          inArray(booking.coachId, coachIds),
          inArray(booking.status, ACTIVE_BOOKING_STATUSES),
          gte(booking.startsAt, new Date()),
        ),
      ),
  ]);
  return { windows, busy };
}

export type ClientBooking = {
  id: string;
  type: SessionType;
  startsAt: Date;
  durationMin: number;
  location: string;
  status: BookingStatus;
  coachName: string;
};

/** Every non-cancelled booking for a client, for the bookings-screen list. */
export async function getClientBookings(
  clientId: string,
): Promise<ClientBooking[]> {
  return db
    .select({
      id: booking.id,
      type: booking.type,
      startsAt: booking.startsAt,
      durationMin: booking.durationMin,
      location: booking.location,
      status: booking.status,
      coachName: user.name,
    })
    .from(booking)
    .innerJoin(coachProfile, eq(coachProfile.id, booking.coachId))
    .innerJoin(user, eq(user.id, coachProfile.userId))
    .where(and(eq(booking.clientId, clientId), ne(booking.status, "cancelled")))
    .orderBy(booking.startsAt);
}
