import { error, fail, redirect } from "@sveltejs/kit";
import type { SessionType } from "@repo/database/schema";
import {
  createBooking,
  getClientActivePackages,
  getClientIntakeSubmitted,
  getCoachBySlug,
  getCoachOpenHours,
  getCoachPackageById,
  getCoachPackages,
  getCoachSlotsForDate,
} from "$lib/server/queries";
import { BOOKING_SHARE_HOST } from "$lib/server/config";
import { actionFailure } from "$lib/server/errors";
import {
  buyPackage,
  getPurchaseBlockReason,
  purchaseFailure,
} from "$lib/server/packages";
import { zonedDateParts } from "$lib/utils/availability";
import {
  allowedSessionTypes,
  parseDateParam,
  resolveBookingSelection,
  resolveSessionType,
} from "./coach";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, url, locals }) => {
  const coach = await getCoachBySlug(params.slug);
  if (!coach) error(404, "coach not found");

  const [packages, openHours, activePackages, parqSubmitted, purchaseBlockReason] =
    await Promise.all([
      getCoachPackages(coach.id),
      getCoachOpenHours(coach.id),
      locals.user
        ? getClientActivePackages(locals.user.id, coach.id)
        : Promise.resolve([]),
      locals.user
        ? getClientIntakeSubmitted(locals.user.id)
        : Promise.resolve(false),
      locals.user
        ? getPurchaseBlockReason(locals.user.id)
        : Promise.resolve(null),
    ]);

  // Unknown client zone (`user.timezone` unset) is treated as not cross-timezone —
  // permissive by default rather than blocking bookings over missing data.
  const crossTimezone =
    !!locals.user?.timezone && locals.user.timezone !== coach.timezone;
  const allowedTypes = allowedSessionTypes({ crossTimezone, parqSubmitted });
  const sessionType = resolveSessionType(
    url.searchParams.get("type") ?? "1:1 in-person",
    allowedTypes,
  );

  const { selectedPurchase, durationMin, rangeEnd } = resolveBookingSelection({
    sessionType,
    packageIdParam: url.searchParams.get("package"),
    activePackages,
  });

  const today = zonedDateParts(new Date(), coach.timezone);
  const selectedDate = parseDateParam(url.searchParams.get("date")) ?? today;

  const slots = durationMin
    ? await getCoachSlotsForDate({
        coachId: coach.id,
        zone: coach.timezone,
        date: selectedDate,
        durationMin,
      })
    : [];

  // href includes protocol domain and trailing slash
  const shareUrl = `${BOOKING_SHARE_HOST.href}book/${params.slug}`;

  return {
    coach,
    packages,
    openHours,
    activePackages,
    purchaseBlockReason,
    allowedTypes,
    crossTimezone,
    parqSubmitted,
    sessionType,
    selectedPurchase,
    durationMin,
    today,
    selectedDate,
    rangeEnd,
    slots,
    shareUrl,
  };
};

export const actions: Actions = {
  // Re-derives everything from `request.url` the same way `load` does —
  // type/package/date/startsAt are already URL state, so there's nothing to
  // trust from hidden form fields for them. Only `note` and `location` are
  // genuine posted fields. Every gate is re-checked here regardless of what
  // the page showed, since the URL (and the world) can have changed since
  // the page was loaded.
  request: async ({ params, url, request, locals }) => {
    if (!locals.user || locals.user.role !== "client") {
      return fail(403, { message: "not allowed" });
    }

    try {
      const coach = await getCoachBySlug(params.slug);
      if (!coach) error(404, "coach not found");

      const [activePackages, parqSubmitted] = await Promise.all([
        getClientActivePackages(locals.user.id, coach.id),
        getClientIntakeSubmitted(locals.user.id),
      ]);

      const crossTimezone = !!locals.user.timezone && locals.user.timezone !== coach.timezone;
      const allowedTypes = allowedSessionTypes({ crossTimezone, parqSubmitted });
      const sessionType = url.searchParams.get("type") ?? "1:1 in-person";
      if (!allowedTypes.includes(sessionType)) {
        return fail(400, { message: "that session type isn't available for you right now" });
      }

      const { selectedPurchase, durationMin } = resolveBookingSelection({
        sessionType,
        packageIdParam: url.searchParams.get("package"),
        activePackages,
      });

      if (!durationMin) {
        return fail(400, { message: `get a package with ${coach.name.split(" ")[0]} to book a session` });
      }
      if (selectedPurchase && selectedPurchase.bookable < 1) {
        return fail(400, { message: "no sessions left on that package right now" });
      }

      const startsAtParam = url.searchParams.get("startsAt");
      const startsAt = startsAtParam ? new Date(startsAtParam) : null;
      if (!startsAt || Number.isNaN(startsAt.getTime())) {
        return fail(400, { message: "pick a time first" });
      }
      if (selectedPurchase && startsAt > selectedPurchase.expiresAt) {
        return fail(400, { message: "that date is after this package expires" });
      }

      const slots = await getCoachSlotsForDate({
        coachId: coach.id,
        zone: coach.timezone,
        date: zonedDateParts(startsAt, coach.timezone),
        durationMin,
      });
      const matchingSlot = slots.find((s) => s.start.getTime() === startsAt.getTime());
      if (!matchingSlot?.available) {
        return fail(409, { message: "that slot's no longer available — pick another time" });
      }

      const formData = await request.formData();
      const note = formData.get("note")?.toString().trim() || null;
      const locationInput = formData.get("location")?.toString().trim();
      const location =
        sessionType === "1:1 online"
          ? "video call"
          : (locationInput ?? coach.locations.find((l) => l !== "online") ?? coach.locations[0] ?? "");

      await createBooking({
        clientId: locals.user.id,
        coachId: coach.id,
        type: sessionType as SessionType,
        location,
        startsAt,
        durationMin,
        packagePurchaseId: selectedPurchase?.purchaseId ?? null,
        clientNote: note,
      });

      redirect(303, "/bookings?tab=awaiting_action&booked=1");
    } catch (err) {
      return actionFailure(err, "we couldn't send your request — please try again");
    }
  },

  // Buy a package without leaving the booking form. Returns instead of
  // redirecting so the URL (type/date/startsAt) is untouched and the page's
  // `load` just reruns, surfacing the new purchase in `activePackages`.
  // Only `packageId` is trusted from the form, revalidated against this coach.
  buy: async ({ params, request, locals }) => {
    if (!locals.user || locals.user.role !== "client") {
      return fail(403, { message: "not allowed" });
    }

    try {
      const coach = await getCoachBySlug(params.slug);
      if (!coach) error(404, "coach not found");

      const packageId = (await request.formData()).get("packageId")?.toString();
      if (!packageId) return fail(400, { message: "pick a package first" });

      const pkg = await getCoachPackageById(coach.id, packageId);
      if (!pkg) return fail(400, { message: "that package isn't available anymore" });

      const result = await buyPackage(locals.user.id, pkg);
      if (!result.ok) return fail(409, { message: result.reason });

      return { boughtPackage: pkg.name };
    } catch (err) {
      return purchaseFailure(err);
    }
  },
};
