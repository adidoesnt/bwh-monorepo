import { error, fail, redirect } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { booking, creditLedgerEntry } from "@repo/database/schema";
import { daySlots, type Window } from "$lib/availability";
import {
  canReschedule,
  creditCostFor,
  ONLINE_TYPES,
  PRE_SCREENING_TYPES,
  SESSION_TYPES,
} from "$lib/booking";
import { db } from "$lib/server/db";
import {
  coachAvailabilityInputs,
  getActivePackage,
  getClientNavBadges,
  getCoachBySlug,
  getCreditBalance,
  getIntakeComplete,
  getManagedBooking,
} from "$lib/server/queries";
import type { Actions, PageServerLoad } from "./$types";

const dropCoachId = (w: { weekday: number; startMin: number; endMin: number }): Window => ({
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
  const [{ windows, busy }, badges, pkg, managed] = await Promise.all([
    coachAvailabilityInputs([coach.id]),
    canBook ? getClientNavBadges(user.id) : Promise.resolve(null),
    canBook ? getActivePackage(user.id) : Promise.resolve(null),
    canBook && rescheduleId
      ? getManagedBooking(rescheduleId, user.id)
      : Promise.resolve(null),
  ]);

  // Only offer reschedule for this coach's still-movable bookings.
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
    busy: excludeSelf(busy, reschedule).map((b) => ({
      startsAt: b.startsAt.toISOString(),
      durationMin: b.durationMin,
    })),
    creditBalance: badges?.creditBalance ?? 0,
    intakeComplete: badges?.intakeComplete ?? true,
    // Sessions can't be booked past the day the current package's credits expire.
    activePackage: pkg
      ? { name: pkg.name, expiresAt: pkg.expiresAt.toISOString() }
      : null,
    reschedule: reschedule
      ? {
          id: reschedule.id,
          type: reschedule.type,
          durationMin: reschedule.durationMin,
          location: reschedule.location,
          note: reschedule.clientNote,
          startsAt: reschedule.startsAt.toISOString(),
        }
      : null,
  };
};

const requestSchema = z.object({
  dateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startMin: z.coerce.number().int().min(0).max(1439),
  durationMin: z.coerce.number().refine((n) => [45, 60, 90].includes(n)),
  type: z.enum(SESSION_TYPES),
  location: z.string().trim().min(1).max(120),
  note: z.string().trim().max(500).optional(),
  clientZone: z.string().trim().min(1).max(64),
});

const rescheduleSchema = requestSchema.extend({ bookingId: z.string().min(1) });

/** Shared gate + slot re-validation for request / reschedule. Returns the
 *  resolved slot instant or a `fail`-ready error string. */
async function resolveSlot(opts: {
  coach: NonNullable<Awaited<ReturnType<typeof getCoachBySlug>>>;
  userId: string;
  userZone: string | null | undefined;
  data: z.infer<typeof requestSchema>;
  excludeBusy: { startsAt: Date; durationMin: number } | null;
}): Promise<{ at: Date } | { error: string }> {
  const { coach, userId, userZone, data, excludeBusy } = opts;
  const { dateISO, startMin, durationMin, type, clientZone } = data;

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

  const pkg = await getActivePackage(userId);
  if (pkg && picked.at > pkg.expiresAt) {
    return {
      error: `that's after your ${pkg.name} credits expire — pick an earlier date`,
    };
  }

  return { at: picked.at };
}

export const actions: Actions = {
  request: async ({ request, params, locals }) => {
    if (!locals.user || locals.user.role !== "client") {
      return fail(403, { error: "clients only" });
    }
    const coach = await getCoachBySlug(params.slug);
    if (!coach) return fail(404, { error: "coach not found" });

    const parsed = requestSchema.safeParse(
      Object.fromEntries(await request.formData()),
    );
    if (!parsed.success)
      return fail(400, { error: "check the form and try again" });
    const { durationMin, type, location, note } = parsed.data;

    const slot = await resolveSlot({
      coach,
      userId: locals.user.id,
      userZone: locals.user.timezone,
      data: parsed.data,
      excludeBusy: null,
    });
    if ("error" in slot) return fail(400, { error: slot.error });

    const creditCost = creditCostFor(type, durationMin);
    const balance = await getCreditBalance(locals.user.id);
    const status =
      creditCost === "0.00" || balance >= Number(creditCost)
        ? "pending_approval"
        : "pending_payment";

    await db.insert(booking).values({
      clientId: locals.user.id,
      coachId: coach.id,
      type,
      location,
      startsAt: slot.at,
      durationMin,
      creditCost,
      status,
      clientNote: note ?? null,
    });

    redirect(303, "/bookings?requested=1");
  },

  reschedule: async ({ request, params, locals }) => {
    if (!locals.user || locals.user.role !== "client") {
      return fail(403, { error: "clients only" });
    }
    const coach = await getCoachBySlug(params.slug);
    if (!coach) return fail(404, { error: "coach not found" });

    const parsed = rescheduleSchema.safeParse(
      Object.fromEntries(await request.formData()),
    );
    if (!parsed.success)
      return fail(400, { error: "check the form and try again" });
    const { bookingId, durationMin, type, location, note } = parsed.data;

    const userId = locals.user.id;
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
      data: parsed.data,
      excludeBusy: current,
    });
    if ("error" in slot) return fail(400, { error: slot.error });

    const creditCost = creditCostFor(type, durationMin);
    // A confirmed session goes back for approval; its credit is returned now so
    // Phase 9's re-approval re-charges cleanly.
    const nextStatus =
      current.status === "confirmed" ? "pending_approval" : current.status;

    await db.transaction(async (tx) => {
      await tx
        .update(booking)
        .set({
          type,
          location,
          startsAt: slot.at,
          durationMin,
          creditCost,
          status: nextStatus,
          clientNote: note ?? null,
        })
        .where(eq(booking.id, current.id));

      if (current.status === "confirmed") {
        await tx.insert(creditLedgerEntry).values({
          clientId: userId,
          bookingId: current.id,
          delta: String(current.creditCost),
          reason: "refund_in_time",
          description: `rescheduled · ${type} · credit returned pending re-approval`,
        });
      }
    });

    redirect(303, "/bookings?rescheduled=1");
  },
};
