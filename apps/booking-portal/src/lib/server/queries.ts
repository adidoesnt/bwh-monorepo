import { and, asc, desc, eq, gt, gte, inArray, sql } from "drizzle-orm";
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

