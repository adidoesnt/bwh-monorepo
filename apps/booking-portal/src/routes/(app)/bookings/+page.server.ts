import type { PageServerLoad } from "./$types";
import {
  getAllCoachTags,
  getClientBookingBucketCounts,
  getClientBookingsPage,
  getCoachBookingBucketCounts,
  getCoachBookingsPage,
  getCoachDirectoryPage,
  getCoachProfileByUserId,
  parseCoachDirectoryParams,
  type BookingBucket,
  type CoachBookingFilter,
} from "$lib/server/queries";

const BOOKING_BUCKETS: BookingBucket[] = ["upcoming", "awaiting_action", "past"];

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

const COACH_BOOKING_FILTERS: CoachBookingFilter[] = ["requests", "to_close"];

const parsePage = (url: URL): number => {
  const page = Number(url.searchParams.get("page"));
  return Number.isInteger(page) && page > 0 ? page : 1;
};

const getTrainerData = async (userId: string, url: URL) => {
  const bucket = parseBookingBucket(url);
  const rawFilter = url.searchParams.get("filter");
  const filter =
    bucket === "awaiting_action" && COACH_BOOKING_FILTERS.includes(rawFilter as CoachBookingFilter)
      ? (rawFilter as CoachBookingFilter)
      : null;
  const search = url.searchParams.get("q") || undefined;

  const coach = await getCoachProfileByUserId(userId);
  if (!coach) {
    return {
      view: "trainer" as const,
      coach,
      bucket,
      filter,
      bookingsPage: { bookings: [], totalCount: 0 },
      bucketCounts: { upcoming: 0, requests: 0, toClose: 0, awaitingAction: 0, past: 0 },
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
