import type { PageServerLoad } from "./$types";
import {
  getAllCoachTags,
  getClientActivePackages,
  getClientRecentActivity,
  getCoachDirectoryPage,
  getSuggestedPackages,
  parseCoachDirectoryParams,
} from "$lib/server/queries";

const NUM_SUGGESTED_PACKAGES = 5;

const getClientData = async (
  clientId: string,
  clientZone: string | null,
  url: URL,
) => {
  const [
    activePackages,
    recentActivity,
    suggestedPackages,
    coachDirectoryPage,
    coachTags,
  ] = await Promise.all([
    getClientActivePackages(clientId),
    getClientRecentActivity(clientId),
    getSuggestedPackages(clientId, clientZone, NUM_SUGGESTED_PACKAGES),
    getCoachDirectoryPage(parseCoachDirectoryParams(url)),
    getAllCoachTags(),
  ]);

  return {
    activePackages,
    recentActivity,
    suggestedPackages,
    coachDirectoryPage,
    coachTags,
  };
};

const EMPTY_PACKAGES_DATA = {
  activePackages: [],
  recentActivity: [],
  suggestedPackages: [],
  coachDirectoryPage: { coaches: [], totalCount: 0 },
  coachTags: [] as string[],
};

export const load: PageServerLoad = async ({ locals, url }) => {
  const { user } = locals;

  switch (user?.role) {
    case "client":
      return await getClientData(user.id, user.timezone ?? null, url);
    case "admin":
      console.warn("Admin packages view not implemented yet!");
      return EMPTY_PACKAGES_DATA;
    case "trainer":
      console.warn("Trainer packages view not implemented yet!");
      return EMPTY_PACKAGES_DATA;
    default:
      throw new Error("Invalid role");
  }
};
