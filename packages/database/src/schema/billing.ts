import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createId } from "./id";
import { user } from "./auth";
import { coachProfile } from "./coaching";
import { booking } from "./booking";

/**
 * A prepaid bundle a coach sells: `sessionCount` sessions of `sessionLengthMin`
 * minutes each, at `pricePerSessionCents` apiece, usable within `validityDays`
 * of purchase. Total price = sessionCount × pricePerSessionCents (computed).
 * Coaches author their own; editor is Phase 9, seeded until then.
 */
export const packageOffering = pgTable(
  "package",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    coachId: text("coach_id")
      .notNull()
      .references(() => coachProfile.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    description: text("description"),
    sessionCount: integer("session_count").notNull(),
    /** Length of every session in this package, in minutes. */
    sessionLengthMin: integer("session_length_min").notNull(),
    pricePerSessionCents: integer("price_per_session_cents").notNull(),
    /** Sessions expire this many days after purchase. */
    validityDays: integer("validity_days").default(90).notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("package_coachId_idx").on(table.coachId)],
);

/** A client's purchase of a package — the event that grants sessions. */
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
    sessionsGranted: integer("sessions_granted").notNull(),
    /** Session length snapshotted at purchase, so later package edits don't move it. */
    sessionLengthMin: integer("session_length_min").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("package_purchase_clientId_idx").on(table.clientId)],
);

export type SessionLedgerReason =
  | "purchase"
  | "session_consumed"
  | "returned_in_time"
  | "adjustment";

/**
 * Append-only session movements. Sum of `delta` over a client's non-expired
 * purchases with a coach is their bookable balance with that coach. `delta`
 * is signed and whole (one booking = one session).
 */
export const sessionLedgerEntry = pgTable(
  "session_ledger_entry",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    clientId: text("client_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    purchaseId: text("purchase_id")
      .notNull()
      .references(() => packagePurchase.id, { onDelete: "cascade" }),
    bookingId: text("booking_id").references(() => booking.id, {
      onDelete: "set null",
    }),
    delta: integer("delta").notNull(),
    reason: text("reason").$type<SessionLedgerReason>().notNull(),
    /** Human-readable line for the session activity log. */
    description: text("description").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("session_ledger_entry_clientId_idx").on(table.clientId),
    index("session_ledger_entry_purchaseId_idx").on(table.purchaseId),
  ],
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
    /** e.g. "visa ···· 4242", "paynow · awaiting verification", "package". */
    method: text("method").notNull(),
    status: text("status").$type<InvoiceStatus>().notNull(),
    /** S3 object key of the uploaded paynow screenshot, when method is paynow. */
    proofImageKey: text("proof_image_key"),
    issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow().notNull(),
    /** The package a pending PayNow purchase-invoice is for (Phase 9 turns it into a `purchase`). */
    packageId: text("package_id").references(() => packageOffering.id, {
      onDelete: "set null",
    }),
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

export const packageOfferingRelations = relations(packageOffering, ({ one, many }) => ({
  coach: one(coachProfile, {
    fields: [packageOffering.coachId],
    references: [coachProfile.id],
  }),
  purchases: many(packagePurchase),
}));

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
    ledgerEntries: many(sessionLedgerEntry),
  }),
);

export const sessionLedgerEntryRelations = relations(
  sessionLedgerEntry,
  ({ one }) => ({
    client: one(user, {
      fields: [sessionLedgerEntry.clientId],
      references: [user.id],
    }),
    booking: one(booking, {
      fields: [sessionLedgerEntry.bookingId],
      references: [booking.id],
    }),
    purchase: one(packagePurchase, {
      fields: [sessionLedgerEntry.purchaseId],
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
