import { and, eq } from "drizzle-orm";
import {
  booking as bookingTable,
  sessionLedgerEntry,
  invoice,
} from "@repo/database/schema";
import { cancelOutcome, type CancelOutcome } from "$lib/booking";
import { db } from "./db";

export type CancelResult = { outcome: CancelOutcome };

/**
 * Cancel a client's own booking, applying the 24h policy:
 * - `return`  → the session goes back to the pack (`+1` ledger entry)
 * - `forfeit` → the session is spent, nothing back
 * - `void`    → an in-flight paynow invoice is voided (purchase never happened)
 * - `none`    → nothing was consumed yet
 * See `cancelOutcome`.
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
      type: bookingTable.type,
      packagePurchaseId: bookingTable.packagePurchaseId,
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

  await db.transaction(async (tx) => {
    await tx
      .update(bookingTable)
      .set({ status: "cancelled", cancelledAt: new Date() })
      .where(eq(bookingTable.id, row.id));

    if (outcome === "return" && row.packagePurchaseId) {
      await tx.insert(sessionLedgerEntry).values({
        clientId,
        purchaseId: row.packagePurchaseId,
        bookingId: row.id,
        delta: 1,
        reason: "returned_in_time",
        description: `cancelled in time · ${row.type} · session returned`,
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
