import { error, fail, redirect } from "@sveltejs/kit";
import {
  getClientActivePackages,
  getCoachBySlug,
  getCoachPackageById,
  getCoachPackages,
} from "$lib/server/queries";
import {
  buyPackage,
  getPurchaseBlockReason,
  purchaseFailure,
} from "$lib/server/packages";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, locals }) => {
  const coach = await getCoachBySlug(params.slug);
  if (!coach) error(404, "coach not found");

  const [packages, activePackages, purchaseBlockReason] = await Promise.all([
    getCoachPackages(coach.id),
    locals.user
      ? getClientActivePackages(locals.user.id, coach.id)
      : Promise.resolve([]),
    locals.user ? getPurchaseBlockReason(locals.user.id) : Promise.resolve(null),
  ]);

  return { coach, packages, activePackages, purchaseBlockReason };
};

export const actions: Actions = {
  buy: async ({ params, request, locals }) => {
    if (!locals.user || locals.user.role !== "client") {
      return fail(403, { message: "not allowed" });
    }

    try {
      const coach = await getCoachBySlug(params.slug);
      if (!coach) error(404, "coach not found");

      const formData = await request.formData();
      const packageId = formData.get("packageId")?.toString();
      if (!packageId) return fail(400, { message: "pick a package first" });

      const pkg = await getCoachPackageById(coach.id, packageId);
      if (!pkg) return fail(400, { message: "that package isn't available anymore" });

      const result = await buyPackage(locals.user.id, pkg);
      if (!result.ok) return fail(409, { message: result.reason });

      redirect(303, "/packages?bought=1");
    } catch (err) {
      return purchaseFailure(err);
    }
  },
};
