import { and, desc, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import {
  availabilitySlot,
  booking,
  coachProfile,
  intakeResponse,
  invoice,
  packageOffering,
  packagePurchase,
  sessionLedgerEntry,
  user,
  type BookingStatus,
  type SessionLedgerReason,
  type SessionType,
} from "@repo/database/schema";
import { db } from "./db";

/** Booking statuses that occupy a slot on the coach's calendar. */
const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  "pending_approval",
  "confirmed",
];

/** Not-yet-settled bookings — drives the "awaiting action" tab and its nav badge. */
const PENDING_STATUSES: BookingStatus[] = ["pending_approval"];

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

// ─── Packages & session balances ────────────────────────────────────────────

export type PackageSummary = {
  id: string;
  name: string;
  description: string | null;
  sessionCount: number;
  sessionLengthMin: number;
  pricePerSessionCents: number;
  validityDays: number;
};

const packageColumns = {
  id: packageOffering.id,
  name: packageOffering.name,
  description: packageOffering.description,
  sessionCount: packageOffering.sessionCount,
  sessionLengthMin: packageOffering.sessionLengthMin,
  pricePerSessionCents: packageOffering.pricePerSessionCents,
  validityDays: packageOffering.validityDays,
};

export type ActivePurchase = {
  id: string;
  coachId: string;
  coachSlug: string;
  coachName: string;
  packageName: string;
  sessionLengthMin: number;
  sessionsGranted: number;
  sessionsRemaining: number;
  expiresAt: Date;
};

/** Non-expired purchases with sessions left, across every coach, FIFO by expiry. */
export async function getActivePurchases(
  clientId: string,
): Promise<ActivePurchase[]> {
  return db
    .select({
      id: packagePurchase.id,
      coachId: coachProfile.id,
      coachSlug: coachProfile.slug,
      coachName: user.name,
      packageName: packageOffering.name,
      sessionLengthMin: packagePurchase.sessionLengthMin,
      sessionsGranted: packagePurchase.sessionsGranted,
      sessionsRemaining: sql<number>`coalesce(sum(${sessionLedgerEntry.delta}), 0)::int`,
      expiresAt: packagePurchase.expiresAt,
    })
    .from(packagePurchase)
    .innerJoin(
      packageOffering,
      eq(packageOffering.id, packagePurchase.packageId),
    )
    .innerJoin(coachProfile, eq(coachProfile.id, packageOffering.coachId))
    .innerJoin(user, eq(user.id, coachProfile.userId))
    .leftJoin(
      sessionLedgerEntry,
      eq(sessionLedgerEntry.purchaseId, packagePurchase.id),
    )
    .where(
      and(
        eq(packagePurchase.clientId, clientId),
        gte(packagePurchase.expiresAt, new Date()),
      ),
    )
    .groupBy(
      packagePurchase.id,
      coachProfile.id,
      coachProfile.slug,
      user.name,
      packageOffering.name,
    )
    .having(sql`coalesce(sum(${sessionLedgerEntry.delta}), 0) > 0`)
    .orderBy(coachProfile.slug, packagePurchase.expiresAt);
}

export async function getActivePurchasesForCoach(
  clientId: string,
  coachId: string,
): Promise<ActivePurchase[]> {
  return (await getActivePurchases(clientId)).filter(
    (p) => p.coachId === coachId,
  );
}

export async function getSessionsRemaining(clientId: string): Promise<number> {
  return (await getActivePurchases(clientId)).reduce(
    (n, p) => n + p.sessionsRemaining,
    0,
  );
}

/** Signed sum of one purchase's ledger — its current session balance. */
export async function getPurchaseBalance(purchaseId: string): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${sessionLedgerEntry.delta}), 0)::int`,
    })
    .from(sessionLedgerEntry)
    .where(eq(sessionLedgerEntry.purchaseId, purchaseId));
  return row?.total ?? 0;
}

/** `pending_approval` bookings against a purchase — sessions promised but not yet drawn. */
export async function getHeldSessions(purchaseId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(booking)
    .where(
      and(
        eq(booking.packagePurchaseId, purchaseId),
        eq(booking.status, "pending_approval"),
      ),
    );
  return row?.n ?? 0;
}

export async function getCoachPackages(
  coachId: string,
): Promise<PackageSummary[]> {
  return db
    .select(packageColumns)
    .from(packageOffering)
    .where(
      and(
        eq(packageOffering.coachId, coachId),
        eq(packageOffering.active, true),
      ),
    )
    .orderBy(packageOffering.pricePerSessionCents);
}

export async function getPackageById(
  id: string,
): Promise<PackageSummary | null> {
  const [row] = await db
    .select(packageColumns)
    .from(packageOffering)
    .where(eq(packageOffering.id, id))
    .limit(1);
  return row ?? null;
}

export type PurchasablePackage = PackageSummary & {
  active: boolean;
  coachName: string;
  coachSlug: string;
};

/** A package by id with its coach + active flag — for the `?/buy` action. */
export async function getPackageForPurchase(
  id: string,
): Promise<PurchasablePackage | null> {
  const [row] = await db
    .select({
      ...packageColumns,
      active: packageOffering.active,
      coachName: user.name,
      coachSlug: coachProfile.slug,
    })
    .from(packageOffering)
    .innerJoin(coachProfile, eq(coachProfile.id, packageOffering.coachId))
    .innerJoin(user, eq(user.id, coachProfile.userId))
    .where(eq(packageOffering.id, id))
    .limit(1);
  return row ?? null;
}

/** Every active coach's active packages, for "get more sessions" browsing. */
export async function listBuyablePackages(): Promise<PurchasablePackage[]> {
  return db
    .select({
      ...packageColumns,
      active: packageOffering.active,
      coachName: user.name,
      coachSlug: coachProfile.slug,
    })
    .from(packageOffering)
    .innerJoin(coachProfile, eq(coachProfile.id, packageOffering.coachId))
    .innerJoin(user, eq(user.id, coachProfile.userId))
    .where(and(eq(packageOffering.active, true), eq(coachProfile.active, true)))
    .orderBy(user.name, packageOffering.pricePerSessionCents);
}

// ─── /packages · /payments · /activity ──────────────────────────────────────

export type LedgerEntry = {
  delta: number;
  reason: SessionLedgerReason;
  description: string;
  createdAt: Date;
};

export type PurchaseWithLedger = ActivePurchase & { ledger: LedgerEntry[] };

/** Active purchases (as `getActivePurchases`) each with its full ledger, newest first. */
export async function getPurchasesWithLedger(
  clientId: string,
): Promise<PurchaseWithLedger[]> {
  const purchases = await getActivePurchases(clientId);
  if (purchases.length === 0) return [];
  const rows = await db
    .select({
      purchaseId: sessionLedgerEntry.purchaseId,
      delta: sessionLedgerEntry.delta,
      reason: sessionLedgerEntry.reason,
      description: sessionLedgerEntry.description,
      createdAt: sessionLedgerEntry.createdAt,
    })
    .from(sessionLedgerEntry)
    .where(
      inArray(
        sessionLedgerEntry.purchaseId,
        purchases.map((p) => p.id),
      ),
    )
    .orderBy(desc(sessionLedgerEntry.createdAt));
  return purchases.map((p) => ({
    ...p,
    ledger: rows.filter((r) => r.purchaseId === p.id),
  }));
}

export type PendingPurchaseInvoice = {
  id: string;
  number: string;
  amountCents: number;
  issuedAt: Date;
  packageName: string;
  coachName: string;
  sessionCount: number;
};

/** PayNow package purchases the client has submitted but no one has verified yet. */
export async function getPendingPurchaseInvoices(
  clientId: string,
): Promise<PendingPurchaseInvoice[]> {
  return db
    .select({
      id: invoice.id,
      number: invoice.number,
      amountCents: invoice.amountCents,
      issuedAt: invoice.issuedAt,
      packageName: packageOffering.name,
      coachName: user.name,
      sessionCount: packageOffering.sessionCount,
    })
    .from(invoice)
    .innerJoin(packageOffering, eq(packageOffering.id, invoice.packageId))
    .innerJoin(coachProfile, eq(coachProfile.id, packageOffering.coachId))
    .innerJoin(user, eq(user.id, coachProfile.userId))
    .where(and(eq(invoice.clientId, clientId), eq(invoice.status, "pending")))
    .orderBy(desc(invoice.issuedAt));
}

export type ClientInvoice = {
  id: string;
  number: string;
  description: string;
  amountCents: number;
  method: string;
  status: "pending" | "paid" | "no_charge";
  issuedAt: Date;
  proofImageKey: string | null;
};

export async function getClientInvoices(
  clientId: string,
): Promise<ClientInvoice[]> {
  return db
    .select({
      id: invoice.id,
      number: invoice.number,
      description: invoice.description,
      amountCents: invoice.amountCents,
      method: invoice.method,
      status: invoice.status,
      issuedAt: invoice.issuedAt,
      proofImageKey: invoice.proofImageKey,
    })
    .from(invoice)
    .where(eq(invoice.clientId, clientId))
    .orderBy(desc(invoice.issuedAt));
}

export type FullActivityEntry = ActivityEntry & {
  description: string;
  /** Balance of that purchase immediately after this movement. */
  balanceAfter: number;
};

/** Every session-ledger movement, newest first, with a per-purchase running balance. */
export async function getClientActivity(
  clientId: string,
): Promise<FullActivityEntry[]> {
  const rows = await db
    .select({
      purchaseId: sessionLedgerEntry.purchaseId,
      delta: sessionLedgerEntry.delta,
      reason: sessionLedgerEntry.reason,
      description: sessionLedgerEntry.description,
      createdAt: sessionLedgerEntry.createdAt,
      packageName: packageOffering.name,
      coachName: user.name,
    })
    .from(sessionLedgerEntry)
    .innerJoin(
      packagePurchase,
      eq(packagePurchase.id, sessionLedgerEntry.purchaseId),
    )
    .innerJoin(
      packageOffering,
      eq(packageOffering.id, packagePurchase.packageId),
    )
    .innerJoin(coachProfile, eq(coachProfile.id, packageOffering.coachId))
    .innerJoin(user, eq(user.id, coachProfile.userId))
    .where(eq(sessionLedgerEntry.clientId, clientId))
    .orderBy(sessionLedgerEntry.createdAt);

  const running = new Map<string, number>();
  const withBalance = rows.map((r) => {
    const bal = (running.get(r.purchaseId) ?? 0) + r.delta;
    running.set(r.purchaseId, bal);
    return {
      delta: r.delta,
      reason: r.reason,
      description: r.description,
      createdAt: r.createdAt,
      packageName: r.packageName,
      coachName: r.coachName,
      balanceAfter: bal,
    };
  });
  return withBalance.reverse();
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

export type UpcomingBooking = {
  id: string;
  type: SessionType;
  startsAt: Date;
  location: string;
  status: BookingStatus;
  coachName: string;
};

export type DashboardPackage = {
  coachName: string;
  packageName: string;
  sessionsRemaining: number;
  sessionsGranted: number;
  expiresAt: Date;
};

export type ActivityEntry = {
  delta: number;
  reason: SessionLedgerReason;
  createdAt: Date;
  packageName: string;
  coachName: string;
};

export type ClientDashboard = {
  sessionsRemaining: number;
  packages: DashboardPackage[];
  upcoming: UpcomingBooking[];
  activity: ActivityEntry[];
  stats: {
    nextSessionAt: Date | null;
    sessionsDone: number;
    thisWeek: number;
  };
  intakeComplete: boolean;
  /** Bookings needing the client to act (pay / awaiting approval). */
  actionNeeded: number;
};

/** The client's most recent session-ledger movements, newest first. */
export async function getRecentActivity(
  clientId: string,
  limit = 6,
): Promise<ActivityEntry[]> {
  return db
    .select({
      delta: sessionLedgerEntry.delta,
      reason: sessionLedgerEntry.reason,
      createdAt: sessionLedgerEntry.createdAt,
      packageName: packageOffering.name,
      coachName: user.name,
    })
    .from(sessionLedgerEntry)
    .innerJoin(
      packagePurchase,
      eq(packagePurchase.id, sessionLedgerEntry.purchaseId),
    )
    .innerJoin(
      packageOffering,
      eq(packageOffering.id, packagePurchase.packageId),
    )
    .innerJoin(coachProfile, eq(coachProfile.id, packageOffering.coachId))
    .innerJoin(user, eq(user.id, coachProfile.userId))
    .where(
      and(
        eq(sessionLedgerEntry.clientId, clientId),
        lt(sessionLedgerEntry.createdAt, new Date()),
      ),
    )
    .orderBy(desc(sessionLedgerEntry.createdAt))
    .limit(limit);
}

async function upcomingBookings(
  clientId: string,
  limit: number,
): Promise<UpcomingBooking[]> {
  return db
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

/** Just the figures the sidebar badges need. */
export async function getClientNavBadges(clientId: string) {
  const [purchases, actionRow, intakeRow] = await Promise.all([
    getActivePurchases(clientId),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(booking)
      .where(
        and(
          eq(booking.clientId, clientId),
          inArray(booking.status, PENDING_STATUSES),
        ),
      ),
    db
      .select({ submittedAt: intakeResponse.submittedAt })
      .from(intakeResponse)
      .where(eq(intakeResponse.clientId, clientId))
      .limit(1),
  ]);

  return {
    sessionsRemaining: purchases.reduce((n, p) => n + p.sessionsRemaining, 0),
    actionNeeded: actionRow[0]?.n ?? 0,
    intakeComplete: Boolean(intakeRow[0]?.submittedAt),
  };
}

export async function getClientDashboard(
  clientId: string,
): Promise<ClientDashboard> {
  const { start, end } = weekBounds(new Date());

  const [
    purchases,
    upcoming,
    activity,
    doneRow,
    weekRow,
    intakeRow,
    actionRow,
  ] = await Promise.all([
    getActivePurchases(clientId),
    upcomingBookings(clientId, 3),
    getRecentActivity(clientId, 5),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(booking)
      .where(
        and(eq(booking.clientId, clientId), eq(booking.status, "completed")),
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
          inArray(booking.status, PENDING_STATUSES),
        ),
      ),
  ]);

  return {
    sessionsRemaining: purchases.reduce((n, p) => n + p.sessionsRemaining, 0),
    packages: purchases.map((p) => ({
      coachName: p.coachName,
      packageName: p.packageName,
      sessionsRemaining: p.sessionsRemaining,
      sessionsGranted: p.sessionsGranted,
      expiresAt: p.expiresAt,
    })),
    upcoming,
    activity,
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

const cheapestSessionCents = sql<
  number | null
>`(select min(${packageOffering.pricePerSessionCents}) from ${packageOffering} where ${packageOffering.coachId} = ${coachProfile.id} and ${packageOffering.active} = true)`;

const coachColumns = {
  id: coachProfile.id,
  slug: coachProfile.slug,
  name: user.name,
  speciality: coachProfile.speciality,
  tagline: coachProfile.tagline,
  bio: coachProfile.bio,
  tags: coachProfile.tags,
  cheapestSessionCents,
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
  /** Cheapest active package's per-session price, or null if none published. */
  cheapestSessionCents: number | null;
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
  coachSlug: string;
  coachActive: boolean;
  clientNote: string | null;
  clientReflection: string | null;
  /** The purchase this session draws from, if any. */
  packagePurchaseId: string | null;
  /** Name of that purchase's package — for cancel / reschedule copy. */
  packageName: string | null;
};

const clientBookingColumns = {
  id: booking.id,
  type: booking.type,
  startsAt: booking.startsAt,
  durationMin: booking.durationMin,
  location: booking.location,
  status: booking.status,
  clientNote: booking.clientNote,
  clientReflection: booking.clientReflection,
  packagePurchaseId: booking.packagePurchaseId,
  packageName: packageOffering.name,
  coachName: user.name,
  coachSlug: coachProfile.slug,
  coachActive: coachProfile.active,
};

/** Every non-cancelled booking for a client, for the bookings-screen list. */
export async function getClientBookings(
  clientId: string,
): Promise<ClientBooking[]> {
  return db
    .select(clientBookingColumns)
    .from(booking)
    .innerJoin(coachProfile, eq(coachProfile.id, booking.coachId))
    .innerJoin(user, eq(user.id, coachProfile.userId))
    .leftJoin(
      packagePurchase,
      eq(packagePurchase.id, booking.packagePurchaseId),
    )
    .leftJoin(
      packageOffering,
      eq(packageOffering.id, packagePurchase.packageId),
    )
    .where(and(eq(booking.clientId, clientId), ne(booking.status, "cancelled")))
    .orderBy(booking.startsAt);
}

export type ManagedBooking = {
  id: string;
  coachId: string;
  coachSlug: string;
  coachName: string;
  type: SessionType;
  location: string;
  startsAt: Date;
  durationMin: number;
  status: BookingStatus;
  clientNote: string | null;
  packagePurchaseId: string | null;
  packageName: string | null;
  purchaseExpiresAt: Date | null;
};

/** A client's own booking by id, with what the cancel / reschedule actions need. */
export async function getManagedBooking(
  bookingId: string,
  clientId: string,
): Promise<ManagedBooking | null> {
  const [row] = await db
    .select({
      id: booking.id,
      coachId: booking.coachId,
      coachSlug: coachProfile.slug,
      coachName: user.name,
      type: booking.type,
      location: booking.location,
      startsAt: booking.startsAt,
      durationMin: booking.durationMin,
      status: booking.status,
      clientNote: booking.clientNote,
      packagePurchaseId: booking.packagePurchaseId,
      packageName: packageOffering.name,
      purchaseExpiresAt: packagePurchase.expiresAt,
    })
    .from(booking)
    .innerJoin(coachProfile, eq(coachProfile.id, booking.coachId))
    .innerJoin(user, eq(user.id, coachProfile.userId))
    .leftJoin(
      packagePurchase,
      eq(packagePurchase.id, booking.packagePurchaseId),
    )
    .leftJoin(
      packageOffering,
      eq(packageOffering.id, packagePurchase.packageId),
    )
    .where(and(eq(booking.id, bookingId), eq(booking.clientId, clientId)))
    .limit(1);
  return row ?? null;
}

/** Next `bwh-NNNN` invoice number, continuing from the highest one issued so far. */
export async function nextInvoiceNumber(): Promise<string> {
  const [row] = await db
    .select({
      max: sql<number | null>`max(substring(${invoice.number} from 5)::int)`,
    })
    .from(invoice);
  const n = (row?.max ?? 0) + 1;
  return `bwh-${n.toString().padStart(4, "0")}`;
}
