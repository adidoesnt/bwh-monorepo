import type { PageServerLoad } from "./$types";
import {
  getClientActivePackages,
  getClientRecentActivity,
} from "$lib/server/queries";

const getClientData = async (clientId: string, url: URL) => {
  const [activePackages, recentActivity] = await Promise.all([
    getClientActivePackages(clientId),
    getClientRecentActivity(clientId),
  ]);

  return { activePackages, recentActivity };
};

const EMPTY_PACKAGES_DATA = {
  activePackages: [],
  recentActivity: [],
};

export const load: PageServerLoad = async ({ locals, url }) => {
  const { user } = locals;

  switch (user?.role) {
    case "client":
      return await getClientData(user.id, url);
    case "admin":
      console.warn("Admin bookings view not implemented yet!");
      return EMPTY_PACKAGES_DATA;
    case "trainer":
      console.warn("Trainer bookings view not implemented yet!");
      return EMPTY_PACKAGES_DATA;
    default:
      throw new Error("Invalid role");
  }
};
