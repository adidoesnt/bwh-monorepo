import type { PageServerLoad } from "./$types";
import {
  getClientUpcomingBookings,
  getClientActivePackages,
  getClientRecentActivity,
} from "$lib/server/queries";

const getClientData = async (clientId: string) => {
  const [upcomingBookings, activePackages, recentActivity] = await Promise.all([
    getClientUpcomingBookings(clientId),
    getClientActivePackages(clientId),
    getClientRecentActivity(clientId),
  ]);

  return {
    upcomingBookings,
    activePackages,
    recentActivity,
  };
};

export const load: PageServerLoad = async ({ locals }) => {
  const { user } = locals;

  switch (user?.role) {
    case "client":
      return await getClientData(user.id);
    case "admin":
      console.warn("Admin dashboard not implemented yet!");
      return {};
    case "trainer":
      console.warn("Trainer dashboard not implemented yet!");
      return {};
    default:
      throw new Error("Invalid role");
  }
};
