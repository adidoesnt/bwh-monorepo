import { error, fail, redirect } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { booking, sessionLedgerEntry } from "@repo/database/schema";
import { daySlots, type Window } from "$lib/availability";
import {
  canReschedule,
  CONSULT_MIN,
  ONLINE_TYPES,
  PRE_SCREENING_TYPES,
  SESSION_TYPES,
} from "$lib/booking";
import { db } from "$lib/server/db";
import {
  coachAvailabilityInputs,
  getActivePurchasesForCoach,
  getCoachBySlug,
  getCoachPackages,
  getClientNavBadges,
  getHeldSessions,
  getIntakeComplete,
  getManagedBooking,
  getPackageById,
  getPurchaseBalance,
} from "$lib/server/queries";
import type { Actions, PageServerLoad } from "./$types";

const dropCoachId = (w: {
  weekday: number;
  startMin: number;
  endMin: number;
}): Window => ({
  weekday: w.weekday,
  startMin: w.startMin,
  endMin: w.endMin,
});

/** Busy entries minus the booking being rescheduled — it mustn't block itself. */
const excludeSelf = (
  busy: { startsAt: Date; durationMin: number }[],
  self: { startsAt: Date; durationMin: number } | null,
) =>
  self
    ? busy.filter(
        (b) =>
          !(
            b.startsAt.getTime() === self.startsAt.getTime() &&
            b.durationMin === self.durationMin
          ),
      )
    : busy;

export const load: PageServerLoad = async ({ params, parent, url }) => {
  const { user } = await parent();
  const coach = await getCoachBySlug(params.slug);
  if (!coach) error(404, "coach not found");

  const canBook = user.role === "client";
  const rescheduleId = url.searchParams.get("reschedule");
  const [{ windows, busy }, badges, purchases, packages, managed] =
    await Promise.all([
      coachAvailabilityInputs([coach.id]),
      canBook ? getClientNavBadges(user.id) : Promise.resolve(null),
      canBook
        ? getActivePurchasesForCoach(user.id, coach.id)
        : Promise.resolve([]),
      canBook ? getCoachPackages(coach.id) : Promise.resolve([]),
      canBook && rescheduleId
        ? getManagedBooking(rescheduleId, user.id)
        : Promise.resolve(null),
    ]);

  const reschedule =
    managed &&
    managed.coachId === coach.id &&
    canReschedule(managed.status, managed.startsAt)
      ? managed
      : null;

  return {
    coach,
    canBook,
    windows: windows.map(dropCoachId),
    busy: excludeSelf(
      busy,
      reschedule
        ? {
            startsAt: reschedule.startsAt,
            durationMin: reschedule.durationMin,
          }
        : null,
    ).map((b) => ({
      startsAt: b.startsAt.toISOString(),
      durationMin: b.durationMin,
    })),
    intakeComplete: badges?.intakeComplete ?? true,
    purchases: purchases.map((p) => ({
      id: p.id,
      packageName: p.packageName,
      sessionLengthMin: p.sessionLengthMin,
      sessionsRemaining: p.sessionsRemaining,
      expiresAt: p.expiresAt.toISOString(),
    })),
    packages,
    reschedule: reschedule
      ? {
          id: reschedule.id,
          type: reschedule.type,
          durationMin: reschedule.durationMin,
          location: reschedule.location,
          note: reschedule.clientNote,
          startsAt: reschedule.startsAt.toISOString(),
          packageName: reschedule.packageName,
          purchaseExpiresAt:
            reschedule.purchaseExpiresAt?.toISOString() ?? null,
        }
      : null,
  };
};

const requestSchema = z.object({
  dateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startMin: z.coerce.number().int().min(0).max(1439),
  type: z.enum(SESSION_TYPES),
  location: z.string().trim().min(1).max(120),
  note: z.string().trim().max(500).optional(),
  clientZone: z.string().trim().min(1).max(64),
  /** Draw the session from this active purchase … */
  purchaseId: z.string().trim().min(1).optional(),
  /** … or buy this package to hold it (pending_payment). */
  packageId: z.string().trim().min(1).optional(),
});

const rescheduleSchema = z.object({
  bookingId: z.string().min(1),
  dateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startMin: z.coerce.number().int().min(0).max(1439),
  type: z.enum(SESSION_TYPES),
  location: z.string().trim().min(1).max(120),
  note: z.string().trim().max(500).optional(),
  clientZone: z.string().trim().min(1).max(64),
});

type Coach = NonNullable<Awaited<ReturnType<typeof getCoachBySlug>>>;

/** Timezone / screening / slot gate shared by request and reschedule. */
async function resolveSlot(opts: {
  coach: Coach;
  userId: string;
  userZone: string | null | undefined;
  dateISO: string;
  startMin: number;
  type: (typeof SESSION_TYPES)[number];
  clientZone: string;
  durationMin: number;
  excludeBusy: { startsAt: Date; durationMin: number } | null;
}): Promise<{ at: Date } | { error: string }> {
  const {
    coach,
    userId,
    userZone,
    dateISO,
    startMin,
    type,
    clientZone,
    durationMin,
    excludeBusy,
  } = opts;

  const effZone = userZone ?? clientZone;
  if (effZone !== coach.timezone && !ONLINE_TYPES.includes(type)) {
    return {
      error: `${coach.name.split(" ")[0]} coaches from ${coach.timezone} — only online sessions work across timezones`,
    };
  }

  if (
    !PRE_SCREENING_TYPES.includes(type) &&
    !(await getIntakeComplete(userId))
  ) {
    return {
      error: "finish your par-q screening before booking a training session",
    };
  }

  const { windows, busy } = await coachAvailabilityInputs([coach.id]);
  const picked = daySlots({
    windows: windows.map(dropCoachId),
    busy: excludeSelf(busy, excludeBusy),
    dateISO,
    durationMin,
    coachZone: coach.timezone,
  }).find((s) => s.startMin === startMin && s.ok);
  if (!picked) return { error: "that slot is no longer available" };

  return { at: picked.at };
}

export const actions: Actions = {
  request: async ({ request, params, locals }) => {
    if (!locals.user || locals.user.role !== "client") {
      return fail(403, { error: "clients only" });
    }
    const userId = locals.user.id;
    const coach = await getCoachBySlug(params.slug);
    if (!coach) return fail(404, { error: "coach not found" });

    const parsed = requestSchema.safeParse(
      Object.fromEntries(await request.formData()),
    );
    if (!parsed.success) {
      return fail(400, { error: "check the form and try again" });
    }
    const { type, location, note, purchaseId, packageId } = parsed.data;

    // Work out the session length, resulting status, and what backs the booking.
    let durationMin: number;
    let status: "pending_approval" | "pending_payment";
    let packagePurchaseId: string | null = null;
    let intendedPackageId: string | null = null;
    let expiryCap: Date | null = null;

    if (type === "free consult") {
      durationMin = CONSULT_MIN;
      status = "pending_approval";
    } else if (purchaseId) {
      const purchases = await getActivePurchasesForCoach(userId, coach.id);
      const purchase = purchases.find((p) => p.id === purchaseId);
      if (!purchase) {
        return fail(400, { error: "that package is no longer active" });
      }
      const [balance, held] = await Promise.all([
        getPurchaseBalance(purchase.id),
        getHeldSessions(purchase.id),
      ]);
      if (balance - held < 1) {
        return fail(400, {
          error: "you've used up the sessions in that package",
        });
      }
      durationMin = purchase.sessionLengthMin;
      status = "pending_approval";
      packagePurchaseId = purchase.id;
      expiryCap = new Date(purchase.expiresAt);
    } else if (packageId) {
      const pkg = await getPackageById(packageId);
      if (!pkg) return fail(400, { error: "pick a package to continue" });
      durationMin = pkg.sessionLengthMin;
      status = "pending_payment";
      intendedPackageId = pkg.id;
      expiryCap = new Date(Date.now() + pkg.validityDays * 86_400_000);
    } else {
      return fail(400, { error: "pick a package to continue" });
    }

    const slot = await resolveSlot({
      coach,
      userId,
      userZone: locals.user.timezone,
      dateISO: parsed.data.dateISO,
      startMin: parsed.data.startMin,
      type,
      clientZone: parsed.data.clientZone,
      durationMin,
      excludeBusy: null,
    });
    if ("error" in slot) return fail(400, { error: slot.error });

    if (expiryCap && slot.at > expiryCap) {
      return fail(400, {
        error: "that's after those sessions expire — pick an earlier date",
      });
    }

    await db.insert(booking).values({
      clientId: userId,
      coachId: coach.id,
      type,
      location,
      startsAt: slot.at,
      durationMin,
      packagePurchaseId,
      intendedPackageId,
      status,
      clientNote: note ?? null,
    });

    redirect(303, "/bookings?requested=1");
  },

  reschedule: async ({ request, params, locals }) => {
    if (!locals.user || locals.user.role !== "client") {
      return fail(403, { error: "clients only" });
    }
    const userId = locals.user.id;
    const coach = await getCoachBySlug(params.slug);
    if (!coach) return fail(404, { error: "coach not found" });

    const parsed = rescheduleSchema.safeParse(
      Object.fromEntries(await request.formData()),
    );
    if (!parsed.success) {
      return fail(400, { error: "check the form and try again" });
    }
    const { bookingId, type, location, note } = parsed.data;

    const current = await getManagedBooking(bookingId, userId);
    if (!current || current.coachId !== coach.id) {
      return fail(404, { error: "booking not found" });
    }
    if (!canReschedule(current.status, current.startsAt)) {
      return fail(400, { error: "this session can no longer be moved" });
    }

    const slot = await resolveSlot({
      coach,
      userId,
      userZone: locals.user.timezone,
      dateISO: parsed.data.dateISO,
      startMin: parsed.data.startMin,
      type,
      clientZone: parsed.data.clientZone,
      durationMin: current.durationMin,
      excludeBusy: current,
    });
    if ("error" in slot) return fail(400, { error: slot.error });

    if (current.purchaseExpiresAt && slot.at > current.purchaseExpiresAt) {
      return fail(400, {
        error: "that's after those sessions expire — pick an earlier date",
      });
    }

    // A confirmed session goes back for approval; its session is returned now so
    // Phase 9's re-approval re-draws cleanly.
    const nextStatus =
      current.status === "confirmed" ? "pending_approval" : current.status;

    await db.transaction(async (tx) => {
      await tx
        .update(booking)
        .set({
          type,
          location,
          startsAt: slot.at,
          status: nextStatus,
          clientNote: note ?? null,
        })
        .where(eq(booking.id, current.id));

      if (current.status === "confirmed" && current.packagePurchaseId) {
        await tx.insert(sessionLedgerEntry).values({
          clientId: userId,
          purchaseId: current.packagePurchaseId,
          bookingId: current.id,
          delta: 1,
          reason: "returned_in_time",
          description: `rescheduled · ${type} · session returned pending re-approval`,
        });
      }
    });

    redirect(303, "/bookings?rescheduled=1");
  },
};
