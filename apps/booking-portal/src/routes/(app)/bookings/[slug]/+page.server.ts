import { error } from "@sveltejs/kit";
import { getCoachBySlug, getCoachOpenHours, getCoachPackages } from "$lib/server/queries";
import type { PageServerLoad } from "./$types";
import { BOOKING_SHARE_HOST } from "$lib/server/config";

export const load: PageServerLoad = async ({ params }) => {
  const coach = await getCoachBySlug(params.slug);
  if (!coach) error(404, "coach not found");

  const [packages, openHours] = await Promise.all([
    getCoachPackages(coach.id),
    getCoachOpenHours(coach.id),
  ]);

  // href includes protocol domain and trailing slash
  const shareUrl = `${BOOKING_SHARE_HOST.href}book/${params.slug}`;

  return { coach, packages, openHours, shareUrl };
};
