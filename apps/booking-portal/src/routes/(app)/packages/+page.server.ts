import type { PageServerLoad } from "./$types";
import {
  getAllCoachTags,
  getClientActivePackages,
  getClientRecentActivity,
  getCoachDirectoryPage,
  getPurchaseLedgerEntries,
  getSuggestedPackages,
  parseCoachDirectoryParams,
} from "$lib/server/queries";

const NUM_SUGGESTED_PACKAGES = 5;

const getClientData = async (
  clientId: string,
  clientZone: string | null,
  url: URL,
) => {
  // Ledger entries are scoped to the active purchases actually rendered, so
  // this has to wait on activePackages rather than joining the Promise.all below.
  const activePackages = await getClientActivePackages(clientId);

  const [recentActivity, purchaseLedgerEntries, suggestedPackages, coachDirectoryPage, coachTags] =
    await Promise.all([
      getClientRecentActivity(clientId),
      getPurchaseLedgerEntries(activePackages.map((p) => p.purchaseId)),
      getSuggestedPackages(clientId, clientZone, NUM_SUGGESTED_PACKAGES),
      getCoachDirectoryPage(parseCoachDirectoryParams(url)),
      getAllCoachTags(),
    ]);

  return {
    activePackages,
    recentActivity,
    purchaseLedgerEntries,
    suggestedPackages,
    coachDirectoryPage,
    coachTags,
  };
};

const EMPTY_PACKAGES_DATA = {
  activePackages: [],
  recentActivity: [],
  purchaseLedgerEntries: [],
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
