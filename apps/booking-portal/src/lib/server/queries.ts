import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
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

