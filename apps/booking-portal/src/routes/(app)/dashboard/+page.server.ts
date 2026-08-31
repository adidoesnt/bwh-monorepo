import { getClientDashboard } from "$lib/server/queries";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ parent }) => {
  const { user } = await parent();
  if (user.role !== "client") return { dashboard: null };
  return { dashboard: await getClientDashboard(user.id) };
};
