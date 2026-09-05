import { fail } from "@sveltejs/kit";
import { invoice } from "@repo/database/schema";
import { packageTotalCents } from "$lib/booking";
import { STRIPE_NOT_IMPLEMENTED } from "$lib/payments";
import { db } from "$lib/server/db";
import { stripeEnabled } from "$lib/server/payments";
import {
  getPackageForPurchase,
  getPendingPurchaseInvoices,
  getPurchasesWithLedger,
  listBuyablePackages,
  nextInvoiceNumber,
  type PurchaseWithLedger,
  type PendingPurchaseInvoice,
  type PurchasablePackage,
} from "$lib/server/queries";
import type { Actions, PageServerLoad } from "./$types";

const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;

export const load: PageServerLoad = async ({ parent }) => {
  const { user } = await parent();
  if (user.role !== "client") {
    return {
      packages: [] as PurchaseWithLedger[],
      pending: [] as PendingPurchaseInvoice[],
      catalogue: [] as PurchasablePackage[],
      stripeEnabled: stripeEnabled(),
    };
  }
  const [packages, pending, catalogue] = await Promise.all([
    getPurchasesWithLedger(user.id),
    getPendingPurchaseInvoices(user.id),
    listBuyablePackages(),
  ]);
  return { packages, pending, catalogue, stripeEnabled: stripeEnabled() };
};

export const actions: Actions = {
  buy: async ({ request, locals }) => {
    if (!locals.user || locals.user.role !== "client") {
      return fail(403, { error: "clients only" });
    }
    if (stripeEnabled()) {
      return fail(501, { error: STRIPE_NOT_IMPLEMENTED });
    }

    const form = await request.formData();
    const packageId = form.get("packageId");
    const screenshot = form.get("screenshot");
    if (typeof packageId !== "string" || !packageId) {
      return fail(400, { error: "pick a package" });
    }
    if (!(screenshot instanceof File) || screenshot.size === 0) {
      return fail(400, { error: "attach a screenshot of your payment" });
    }
    if (!screenshot.type.startsWith("image/")) {
      return fail(400, { error: "the proof must be an image" });
    }
    if (screenshot.size > MAX_SCREENSHOT_BYTES) {
      return fail(400, { error: "that image is too large (max 5mb)" });
    }

    const pkg = await getPackageForPurchase(packageId);
    if (!pkg || !pkg.active) {
      return fail(400, { error: "that package isn't available any more" });
    }

    // Dynamic import keeps the aws-sdk out of this route's entry chunk.
    const { storage } = await import("$lib/server/storage");
    const ext = screenshot.name.split(".").pop() || "jpg";
    const key = `payment-proofs/pkg-${pkg.id}-${Date.now()}.${ext}`;
    await storage.putObject(
      key,
      new Uint8Array(await screenshot.arrayBuffer()),
      screenshot.type,
    );

    // Only an invoice — the package_purchase + session grant happen at Phase 9
    // verification (see BOOKING-LIFECYCLE.md).
    const number = await nextInvoiceNumber();
    await db.insert(invoice).values({
      number,
      clientId: locals.user.id,
      description: `${pkg.name} · ${pkg.sessionCount} sessions · ${pkg.coachName}`,
      amountCents: packageTotalCents(pkg),
      method: "paynow · awaiting verification",
      status: "pending",
      proofImageKey: key,
      packageId: pkg.id,
    });

    return { success: true };
  },
};
