import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { approveBooking, completeBooking, declineBooking } from "$lib/server/bookings";
import { actionFailure } from "$lib/server/errors";
import {
  getAllCoachTags,
  getClientBookingBucketCounts,
  getClientBookingsPage,
  getCoachBookingBucketCounts,
  getCoachBookingsPage,
  getCoachDirectoryPage,
  getCoachProfileByUserId,
  parseCoachDirectoryParams,
  COACH_BUCKET_FILTERS,
  type BookingBucket,
  type CoachBookingFilter,
} from "$lib/server/queries";

const BOOKING_BUCKETS: BookingBucket[] = ["upcoming", "awaiting_action", "history"];

const parseBookingBucket = (url: URL): BookingBucket => {
  const tab = url.searchParams.get("tab");
  return BOOKING_BUCKETS.includes(tab as BookingBucket) ? (tab as BookingBucket) : "upcoming";
};

const parseBookingsPage = (url: URL): number => {
  const page = Number(url.searchParams.get("bookingsPage"));
  return Number.isInteger(page) && page > 0 ? page : 1;
};

const getClientData = async (clientId: string, url: URL) => {
  const bucket = parseBookingBucket(url);
  const page = parseBookingsPage(url);

  const [bookingsPage, bucketCounts, coachDirectoryPage, coachTags] = await Promise.all([
    getClientBookingsPage({ clientId, bucket, page }),
    getClientBookingBucketCounts(clientId),
    getCoachDirectoryPage(parseCoachDirectoryParams(url)),
    getAllCoachTags(),
  ]);

  return {
    view: "client" as const,
    bucket,
    bookingsPage,
    bucketCounts,
    coachDirectoryPage,
    coachTags,
  };
};

const parsePage = (url: URL): number => {
  const page = Number(url.searchParams.get("page"));
  return Number.isInteger(page) && page > 0 ? page : 1;
};

const getTrainerData = async (userId: string, url: URL) => {
  const bucket = parseBookingBucket(url);
  const rawFilter = url.searchParams.get("filter") as CoachBookingFilter;
  const filter = COACH_BUCKET_FILTERS[bucket].includes(rawFilter) ? rawFilter : null;
  const search = url.searchParams.get("q") || undefined;

  const coach = await getCoachProfileByUserId(userId);
  if (!coach) {
    return {
      view: "trainer" as const,
      coach,
      bucket,
      filter,
      bookingsPage: { bookings: [], totalCount: 0 },
      bucketCounts: {
        upcoming: 0,
        awaitingAction: 0,
        history: 0,
        filters: { requests: 0, to_close: 0, completed: 0, declined: 0, lapsed: 0 },
      },
    };
  }

  const [bookingsPage, bucketCounts] = await Promise.all([
    getCoachBookingsPage({
      coachId: coach.id,
      bucket,
      filter: filter ?? undefined,
      search,
      page: parsePage(url),
    }),
    getCoachBookingBucketCounts(coach.id, search),
  ]);

  return { view: "trainer" as const, coach, bucket, filter, bookingsPage, bucketCounts };
};

export const load: PageServerLoad = async ({ locals, url }) => {
  const { user } = locals;

  switch (user?.role) {
    case "client":
      return await getClientData(user.id, url);
    case "trainer":
      return await getTrainerData(user.id, url);
    case "admin":
      return { view: "admin" as const };
    default:
      throw new Error("Invalid role");
  }
};

/** The acting coach and the posted `bookingId`, or the `fail` to return. */
const parseCoachAction = async (locals: App.Locals, request: Request) => {
  if (!locals.user || locals.user.role !== "trainer") {
    return { error: fail(403, { message: "not allowed" }) };
  }
  const coach = await getCoachProfileByUserId(locals.user.id);
  if (!coach) return { error: fail(403, { message: "not allowed" }) };

  const bookingId = (await request.formData()).get("bookingId");
  if (typeof bookingId !== "string" || !bookingId) {
    return { error: fail(400, { message: "missing booking" }) };
  }
  return { coach, bookingId };
};

// Posted to from the dashboard's "needs action" widget as well as this page.
export const actions: Actions = {
  approve: async ({ locals, request }) => {
    try {
      const parsed = await parseCoachAction(locals, request);
      if ("error" in parsed) return parsed.error;

      const result = await approveBooking(parsed.bookingId, parsed.coach);
      if (!result.ok) return fail(409, { message: result.message });
    } catch (err) {
      return actionFailure(err, "we couldn't approve that request — please try again");
    }
  },

  decline: async ({ locals, request }) => {
    try {
      const parsed = await parseCoachAction(locals, request);
      if ("error" in parsed) return parsed.error;

      const result = await declineBooking(parsed.bookingId, parsed.coach.id);
      if (!result.ok) return fail(409, { message: result.message });
    } catch (err) {
      return actionFailure(err, "we couldn't decline that request — please try again");
    }
  },

  complete: async ({ locals, request }) => {
    try {
      const parsed = await parseCoachAction(locals, request);
      if ("error" in parsed) return parsed.error;

      const result = await completeBooking(parsed.bookingId, parsed.coach.id);
      if (!result.ok) return fail(409, { message: result.message });
    } catch (err) {
      return actionFailure(err, "we couldn't mark that session complete — please try again");
    }
  },
};
