import type { PageServerLoad } from "./$types";
import {
  getAllCoachTags,
  getClientBookingBucketCounts,
  getClientBookingsPage,
  getCoachDirectoryPage,
  type BookingBucket,
  type CoachDirectoryParams,
  type CoachDirectorySort,
} from "$lib/server/queries";

const COACH_DIRECTORY_SORTS: CoachDirectorySort[] = ["name", "price"];
const BOOKING_BUCKETS: BookingBucket[] = ["upcoming", "awaiting_action", "past"];

const parseCoachDirectoryParams = (url: URL): CoachDirectoryParams => {
  const sort = url.searchParams.get("sort");
  const page = Number(url.searchParams.get("page"));
  const pageSize = Number(url.searchParams.get("pageSize"));
  const tags = url.searchParams.get("tags");

  return {
    search: url.searchParams.get("q") ?? undefined,
    tags: tags ? tags.split(",").filter(Boolean) : undefined,
    sort: COACH_DIRECTORY_SORTS.includes(sort as CoachDirectorySort)
      ? (sort as CoachDirectorySort)
      : undefined,
    page: Number.isInteger(page) && page > 0 ? page : undefined,
    pageSize: Number.isInteger(pageSize) && pageSize > 0 ? pageSize : undefined,
  };
};

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

  return { bucket, bookingsPage, bucketCounts, coachDirectoryPage, coachTags };
};

const EMPTY_BOOKINGS_DATA = {
  bucket: "upcoming" as BookingBucket,
  bookingsPage: { bookings: [], totalCount: 0 },
  bucketCounts: { upcoming: 0, awaitingAction: 0, past: 0 },
  coachDirectoryPage: { coaches: [], totalCount: 0 },
  coachTags: [] as string[],
};

export const load: PageServerLoad = async ({ locals, url }) => {
  const { user } = locals;

  switch (user?.role) {
    case "client":
      return await getClientData(user.id, url);
    case "admin":
      console.warn("Admin bookings view not implemented yet!");
      return EMPTY_BOOKINGS_DATA;
    case "trainer":
      console.warn("Trainer bookings view not implemented yet!");
      return EMPTY_BOOKINGS_DATA;
    default:
      throw new Error("Invalid role");
  }
};
