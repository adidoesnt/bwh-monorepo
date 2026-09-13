import { error } from "@sveltejs/kit";
import {
  getClientActivePackages,
  getCoachAvailableStartsForDate,
  getCoachBySlug,
  getCoachOpenHours,
  getCoachPackages,
} from "$lib/server/queries";
import { BOOKING_SHARE_HOST } from "$lib/server/config";
import { zonedDateParts } from "$lib/utils/availability";
import { parseDateParam, resolveBookingSelection } from "./coach";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, url, locals }) => {
  const coach = await getCoachBySlug(params.slug);
  if (!coach) error(404, "coach not found");

  const [packages, openHours, activePackages] = await Promise.all([
    getCoachPackages(coach.id),
    getCoachOpenHours(coach.id),
    locals.user ? getClientActivePackages(locals.user.id, coach.id) : Promise.resolve([]),
  ]);

  const sessionType = url.searchParams.get("type") ?? "1:1 in-person";
  const { selectedPurchase, durationMin, rangeEnd } = resolveBookingSelection({
    sessionType,
    packageIdParam: url.searchParams.get("package"),
    activePackages,
  });

  const today = zonedDateParts(new Date(), coach.timezone);
  const selectedDate = parseDateParam(url.searchParams.get("date")) ?? today;

  const availableStarts = durationMin
    ? await getCoachAvailableStartsForDate({
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
    sessionType,
    selectedPurchase,
    durationMin,
    today,
    selectedDate,
    rangeEnd,
    availableStarts,
    shareUrl,
  };
};
