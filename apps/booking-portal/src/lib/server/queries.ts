import { and, desc, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import {
  booking,
  coachProfile,
  creditLedgerEntry,
  intakeResponse,
  packageOffering,
  packagePurchase,
  user,
} from "@repo/database/schema";
import { db } from "./db";

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
  type: string;
  startsAt: Date;
  location: string;
  status: string;
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

async function creditBalance(clientId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${creditLedgerEntry.delta}), 0)` })
    .from(creditLedgerEntry)
    .where(eq(creditLedgerEntry.clientId, clientId));
  return Number(row?.total ?? 0);
}

async function activePackage(clientId: string, balance: number) {
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

/** Just the figures the sidebar badges need — cheaper than the full dashboard. */
export async function getClientNavBadges(clientId: string) {
  const [balance, actionRow, intakeRow] = await Promise.all([
    creditBalance(clientId),
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
  const balance = await creditBalance(clientId);
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
