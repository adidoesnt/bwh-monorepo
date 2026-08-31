import { error, fail, redirect } from "@sveltejs/kit";
import { z } from "zod";
import { booking } from "@repo/database/schema";
import { daySlots, type Window } from "$lib/availability";
import {
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
} from "$lib/server/queries";
import type { Actions, PageServerLoad } from "./$types";

const dropCoachId = (w: { weekday: number; startMin: number; endMin: number }): Window => ({
  weekday: w.weekday,
  startMin: w.startMin,
  endMin: w.endMin,
});

export const load: PageServerLoad = async ({ params, parent }) => {
  const { user } = await parent();
  const coach = await getCoachBySlug(params.slug);
  if (!coach) error(404, "coach not found");

  const canBook = user.role === "client";
  const [{ windows, busy }, badges, pkg] = await Promise.all([
    coachAvailabilityInputs([coach.id]),
    canBook ? getClientNavBadges(user.id) : Promise.resolve(null),
    canBook ? getActivePackage(user.id) : Promise.resolve(null),
  ]);

  return {
    coach,
    canBook,
    windows: windows.map(dropCoachId),
    busy: busy.map((b) => ({
      startsAt: b.startsAt.toISOString(),
      durationMin: b.durationMin,
    })),
    creditBalance: badges?.creditBalance ?? 0,
    intakeComplete: badges?.intakeComplete ?? true,
    // Sessions can't be booked past the day the current package's credits expire.
    activePackage: pkg
      ? { name: pkg.name, expiresAt: pkg.expiresAt.toISOString() }
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
    if (!parsed.success) return fail(400, { error: "check the form and try again" });
    const { dateISO, startMin, durationMin, type, location, note, clientZone } =
      parsed.data;

    const effZone = locals.user.timezone ?? clientZone;
    if (effZone !== coach.timezone && !ONLINE_TYPES.includes(type)) {
      return fail(400, {
        error: `${coach.name.split(" ")[0]} coaches from ${coach.timezone} — only online sessions work across timezones`,
      });
    }

    if (!PRE_SCREENING_TYPES.includes(type) && !(await getIntakeComplete(locals.user.id))) {
      return fail(400, {
        error: "finish your par-q screening before booking a training session",
      });
    }

    // Never trust the posted time: recompute and require the slot to be real and open.
    const { windows, busy } = await coachAvailabilityInputs([coach.id]);
    const picked = daySlots({
      windows: windows.map(dropCoachId),
      busy,
      dateISO,
      durationMin,
      coachZone: coach.timezone,
    }).find((s) => s.startMin === startMin && s.ok);
    if (!picked) return fail(400, { error: "that slot is no longer available" });

    const pkg = await getActivePackage(locals.user.id);
    if (pkg && picked.at > pkg.expiresAt) {
      return fail(400, {
        error: `that's after your ${pkg.name} credits expire — pick an earlier date`,
      });
    }

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
      startsAt: picked.at,
      durationMin,
      creditCost,
      status,
      clientNote: note ?? null,
    });

    redirect(303, "/bookings?requested=1");
  },
};
