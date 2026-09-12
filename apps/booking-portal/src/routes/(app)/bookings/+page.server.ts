import type { PageServerLoad } from "./$types";
import {
  getClientBookings,
  getCoachDirectoryPage,
  type CoachDirectoryParams,
  type CoachDirectorySort,
} from "$lib/server/queries";

const COACH_DIRECTORY_SORTS: CoachDirectorySort[] = ["name", "price"];

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

const getClientData = async (clientId: string, params: CoachDirectoryParams) => {
  const [bookings, coachDirectoryPage] = await Promise.all([
    getClientBookings(clientId),
    getCoachDirectoryPage(params),
  ]);

  return { bookings, coachDirectoryPage };
};

const EMPTY_BOOKINGS_DATA = {
  bookings: [],
  coachDirectoryPage: { coaches: [], totalCount: 0 },
};

export const load: PageServerLoad = async ({ locals, url }) => {
  const { user } = locals;

  switch (user?.role) {
    case "client":
      return await getClientData(user.id, parseCoachDirectoryParams(url));
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
