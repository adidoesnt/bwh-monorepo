import { and, eq } from "drizzle-orm";
import {
  booking as bookingTable,
  creditLedgerEntry,
  invoice,
} from "@repo/database/schema";
import { cancelOutcome, type CancelOutcome } from "$lib/booking";
import { timeOf } from "$lib/format";
import { db } from "./db";
import { nextInvoiceNumber } from "./queries";

export type CancelResult = { outcome: CancelOutcome };

/**
 * Cancel a client's own booking, applying the 24h policy:
 * refund the credit, forfeit it (with a no-charge invoice for the record), or
 * void an in-flight paynow invoice — see `cancelOutcome`.
 */
export async function cancelBooking(
  bookingId: string,
  clientId: string,
): Promise<CancelResult | { error: string }> {
  const [row] = await db
    .select({
      id: bookingTable.id,
      status: bookingTable.status,
      startsAt: bookingTable.startsAt,
      creditCost: bookingTable.creditCost,
      type: bookingTable.type,
    })
    .from(bookingTable)
    .where(
      and(eq(bookingTable.id, bookingId), eq(bookingTable.clientId, clientId)),
    )
    .limit(1);
  if (!row) return { error: "booking not found" };

  const outcome = cancelOutcome(row.status, row.startsAt);
  if (outcome === "blocked") {
    return { error: "this booking can't be cancelled" };
  }

  const invoiceNumber =
    outcome === "forfeit" ? await nextInvoiceNumber() : null;
  const when = timeOf(row.startsAt, "Asia/Singapore");

  await db.transaction(async (tx) => {
    await tx
      .update(bookingTable)
      .set({ status: "cancelled", cancelledAt: new Date() })
      .where(eq(bookingTable.id, row.id));

    if (outcome === "refund") {
      await tx.insert(creditLedgerEntry).values({
        clientId,
        bookingId: row.id,
        delta: row.creditCost,
        reason: "refund_in_time",
        description: `cancelled in time · ${row.type} · ${when} · credit returned`,
      });
    }

    if (outcome === "forfeit" && invoiceNumber) {
      await tx.insert(invoice).values({
        number: invoiceNumber,
        clientId,
        description: "late cancellation",
        amountCents: 0,
        method: "credit used",
        status: "no_charge",
        bookingId: row.id,
      });
    }

    if (outcome === "void") {
      await tx
        .update(invoice)
        .set({
          status: "no_charge",
          method: "paynow · cancelled before verification",
        })
        .where(
          and(eq(invoice.bookingId, row.id), eq(invoice.status, "pending")),
        );
    }
  });

  return { outcome };
}
