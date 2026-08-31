import { openness } from "$lib/availability";
import {
  coachAvailabilityInputs,
  getClientBookings,
  getCreditBalance,
  listActiveCoaches,
  type ClientBooking,
} from "$lib/server/queries";
import type { PageServerLoad } from "./$types";

/** Slots looked at when ranking coaches by "soonest" / "most open". */
const DIRECTORY_DAYS = 14;
const DIRECTORY_DURATION = 60;

export const load: PageServerLoad = async ({ parent, url }) => {
  const { user } = await parent();
  const requested = url.searchParams.has("requested");
  const empty = {
    coaches: null,
    bookings: [] as ClientBooking[],
    creditBalance: 0,
    requested,
  };
  if (user.role !== "client") return empty;

  const coaches = await listActiveCoaches();
  const ids = coaches.map((c) => c.id);
  const [{ windows, busy }, bookings, creditBalance] = await Promise.all([
    coachAvailabilityInputs(ids),
    getClientBookings(user.id),
    getCreditBalance(user.id),
  ]);

  const now = new Date();
  const withOpenness = coaches.map((c) => {
    const { openCount, nextFreeAt } = openness({
      windows: windows.filter((w) => w.coachId === c.id),
      busy: busy.filter((b) => b.coachId === c.id),
      durationMin: DIRECTORY_DURATION,
      days: DIRECTORY_DAYS,
      coachZone: c.timezone,
      now,
    });
    return { ...c, openCount, nextFreeAt };
  });

  return { coaches: withOpenness, bookings, creditBalance, requested };
};
