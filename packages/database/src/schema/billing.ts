import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createId } from "./id";
import { user } from "./auth";
import { booking } from "./booking";

/** A sellable bundle of session credits. Pricing is editable by admins (Phase 10). */
export const packageOffering = pgTable("package", {
  id: text("id").primaryKey().$defaultFn(createId),
  name: text("name").notNull(),
  sessionCount: integer("session_count").notNull(),
  priceCents: integer("price_cents").notNull(),
  /** Credits expire this many months after purchase. */
  creditExpiryMonths: integer("credit_expiry_months").default(3).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

/** A client's purchase of a package — the event that grants credits. */
export const packagePurchase = pgTable(
  "package_purchase",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    clientId: text("client_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    packageId: text("package_id")
      .notNull()
      .references(() => packageOffering.id, { onDelete: "restrict" }),
    purchasedAt: timestamp("purchased_at", { withTimezone: true }).defaultNow().notNull(),
    pricePaidCents: integer("price_paid_cents").notNull(),
    creditsGranted: integer("credits_granted").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("package_purchase_clientId_idx").on(table.clientId)],
);

export type CreditReason =
  | "purchase"
  | "session_confirmed"
  | "refund_in_time"
  | "late_cancel_forfeit"
  | "adjustment";

/**
 * Append-only credit movements. Sum of `delta` for a client (minus expired
 * purchases) is their balance. `delta` is signed and fractional to match
 * 45/90-minute session costs.
 */
export const creditLedgerEntry = pgTable(
  "credit_ledger_entry",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    clientId: text("client_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    bookingId: text("booking_id").references(() => booking.id, {
      onDelete: "set null",
    }),
    purchaseId: text("purchase_id").references(() => packagePurchase.id, {
      onDelete: "set null",
    }),
    delta: numeric("delta", { precision: 5, scale: 2 }).notNull(),
    reason: text("reason").$type<CreditReason>().notNull(),
    /** Human-readable line for the credit activity log. */
    description: text("description").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("credit_ledger_entry_clientId_idx").on(table.clientId)],
);

export type InvoiceStatus = "pending" | "paid" | "no_charge";

/** A billing record shown on the payments page, with a downloadable receipt. */
export const invoice = pgTable(
  "invoice",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    /** Display number, e.g. "bwh-0182". */
    number: text("number").notNull(),
    clientId: text("client_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    amountCents: integer("amount_cents").notNull(),
    /** e.g. "visa ···· 4242", "paynow · awaiting verification", "credit used". */
    method: text("method").notNull(),
    status: text("status").$type<InvoiceStatus>().notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow().notNull(),
    purchaseId: text("purchase_id").references(() => packagePurchase.id, {
      onDelete: "set null",
    }),
    bookingId: text("booking_id").references(() => booking.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("invoice_number_uidx").on(table.number),
    index("invoice_clientId_idx").on(table.clientId),
  ],
);

export const packagePurchaseRelations = relations(
  packagePurchase,
  ({ one, many }) => ({
    client: one(user, {
      fields: [packagePurchase.clientId],
      references: [user.id],
    }),
    package: one(packageOffering, {
      fields: [packagePurchase.packageId],
      references: [packageOffering.id],
    }),
    ledgerEntries: many(creditLedgerEntry),
  }),
);

export const creditLedgerEntryRelations = relations(
  creditLedgerEntry,
  ({ one }) => ({
    client: one(user, {
      fields: [creditLedgerEntry.clientId],
      references: [user.id],
    }),
    booking: one(booking, {
      fields: [creditLedgerEntry.bookingId],
      references: [booking.id],
    }),
    purchase: one(packagePurchase, {
      fields: [creditLedgerEntry.purchaseId],
      references: [packagePurchase.id],
    }),
  }),
);

export const invoiceRelations = relations(invoice, ({ one }) => ({
  client: one(user, {
    fields: [invoice.clientId],
    references: [user.id],
  }),
}));
