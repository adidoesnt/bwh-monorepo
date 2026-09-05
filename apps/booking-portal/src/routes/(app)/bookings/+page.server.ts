import { fail } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { invoice, booking as bookingTable } from "@repo/database/schema";
import { openness } from "$lib/availability";
import { STRIPE_NOT_IMPLEMENTED } from "$lib/payments";
import { db } from "$lib/server/db";
import { stripeEnabled } from "$lib/server/payments";
import {
  coachAvailabilityInputs,
  getClientBookings,
  getCreditBalance,
  getPayableBooking,
  listActiveCoaches,
  nextInvoiceNumber,
  type ClientBooking,
} from "$lib/server/queries";
import type { Actions, PageServerLoad } from "./$types";

const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;

/** Slots looked at when ranking coaches by "soonest" / "most open". */
const DIRECTORY_DAYS = 14;
const DIRECTORY_DURATION = 60;

export const load: PageServerLoad = async ({ parent, url }) => {
  const { user } = await parent();
  const requested = url.searchParams.has("requested");
  const empty = {
    coaches: null,
    bookings: [] as ClientBooking[],
    creditBalance: 0,
    requested,
    stripeEnabled: stripeEnabled(),
  };
  if (user.role !== "client") return empty;

  const coaches = await listActiveCoaches();
  const ids = coaches.map((c) => c.id);
  const [{ windows, busy }, bookings, creditBalance] = await Promise.all([
    coachAvailabilityInputs(ids),
    getClientBookings(user.id),
    getCreditBalance(user.id),
  ]);

  const now = new Date();
  const withOpenness = coaches.map((c) => {
    const { openCount, nextFreeAt } = openness({
      windows: windows.filter((w) => w.coachId === c.id),
      busy: busy.filter((b) => b.coachId === c.id),
      durationMin: DIRECTORY_DURATION,
      days: DIRECTORY_DAYS,
      coachZone: c.timezone,
      now,
    });
    return { ...c, openCount, nextFreeAt };
  });

  return {
    coaches: withOpenness,
    bookings,
    creditBalance,
    requested,
    stripeEnabled: stripeEnabled(),
  };
};

export const actions: Actions = {
  pay: async ({ request, locals }) => {
    if (!locals.user || locals.user.role !== "client") {
      return fail(403, { error: "clients only" });
    }
    if (stripeEnabled()) {
      return fail(501, { error: STRIPE_NOT_IMPLEMENTED });
    }

    const form = await request.formData();
    const bookingId = form.get("bookingId");
    const screenshot = form.get("screenshot");
    if (typeof bookingId !== "string" || !bookingId) {
      return fail(400, { error: "missing booking" });
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

    // Never trust the client for ownership, status or amount — re-fetch.
    const payable = await getPayableBooking(bookingId, locals.user.id);
    if (!payable) {
      return fail(400, { error: "that booking isn't awaiting payment" });
    }

    // Dynamic import keeps the aws-sdk out of this route's entry chunk —
    // bundling it in leaks an sdk internal as an invalid page export.
    const { storage } = await import("$lib/server/storage");
    const ext = screenshot.name.split(".").pop() || "jpg";
    const key = `payment-proofs/${payable.id}-${Date.now()}.${ext}`;
    await storage.putObject(
      key,
      new Uint8Array(await screenshot.arrayBuffer()),
      screenshot.type,
    );

    const number = await nextInvoiceNumber();
    await db.insert(invoice).values({
      number,
      clientId: locals.user.id,
      description: `${payable.type} · ${payable.coachName}`,
      amountCents: payable.amountCents,
      method: "paynow · awaiting verification",
      status: "pending",
      proofImageKey: key,
      bookingId: payable.id,
    });

    await db
      .update(bookingTable)
      .set({ status: "pending_verification" })
      .where(eq(bookingTable.id, payable.id));

    return { success: true };
  },
};
