import { redirect } from "@sveltejs/kit";
import { auth } from "$lib/server/auth";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  return { user: locals.user };
};

export const actions: Actions = {
  logout: async ({ request }) => {
    await auth.api.signOut({ headers: request.headers });
    redirect(303, "/");
  },
};
