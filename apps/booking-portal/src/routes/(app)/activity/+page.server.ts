import { getClientActivity, type FullActivityEntry } from "$lib/server/queries";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ parent }) => {
  const { user } = await parent();
  if (user.role !== "client") return { activity: [] as FullActivityEntry[] };
  return { activity: await getClientActivity(user.id) };
};
