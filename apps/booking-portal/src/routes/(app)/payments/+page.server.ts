import { CANCELLATION_WINDOW_HOURS } from "$lib/booking";
import { getClientInvoices, type ClientInvoice } from "$lib/server/queries";
import type { PageServerLoad } from "./$types";

export type PaymentRow = ClientInvoice & { proofUrl: string | null };

export const load: PageServerLoad = async ({ parent }) => {
  const { user } = await parent();
  if (user.role !== "client") {
    return {
      invoices: [] as PaymentRow[],
      cancellationHours: CANCELLATION_WINDOW_HOURS,
    };
  }

  const invoices = await getClientInvoices(user.id);
  const keys = invoices.filter((i) => i.proofImageKey);
  let signed = new Map<string, string>();
  if (keys.length > 0) {
    const { storage } = await import("$lib/server/storage");
    const pairs = await Promise.all(
      keys.map(async (i) => {
        try {
          return [
            i.id,
            await storage.presignedGetUrl(i.proofImageKey!),
          ] as const;
        } catch {
          return null;
        }
      }),
    );
    signed = new Map(pairs.filter((p): p is [string, string] => p !== null));
  }

  return {
    invoices: invoices.map((i) => ({
      ...i,
      proofUrl: signed.get(i.id) ?? null,
    })),
    cancellationHours: CANCELLATION_WINDOW_HOURS,
  };
};
