import { error } from "@sveltejs/kit";
import {
  getClientActivePackages,
  getClientIntakeSubmitted,
  getCoachBySlug,
  getCoachOpenHours,
  getCoachPackages,
  getCoachSlotsForDate,
} from "$lib/server/queries";
import { BOOKING_SHARE_HOST } from "$lib/server/config";
import { zonedDateParts } from "$lib/utils/availability";
import {
  allowedSessionTypes,
  parseDateParam,
  resolveBookingSelection,
  resolveSessionType,
} from "./coach";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, url, locals }) => {
  const coach = await getCoachBySlug(params.slug);
  if (!coach) error(404, "coach not found");

  const [packages, openHours, activePackages, parqSubmitted] =
    await Promise.all([
      getCoachPackages(coach.id),
      getCoachOpenHours(coach.id),
      locals.user
        ? getClientActivePackages(locals.user.id, coach.id)
        : Promise.resolve([]),
      locals.user
        ? getClientIntakeSubmitted(locals.user.id)
        : Promise.resolve(false),
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
