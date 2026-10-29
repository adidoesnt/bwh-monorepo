import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { createId } from "./id";
import { user } from "./auth";
import { coachProfile } from "./coaching";
import { packagePurchase } from "./billing";

export type SessionType =
  | "1:1 in-person"
  | "1:1 online"
  | "free consult"
  | "assessment";

/**
 * `pending_payment` / `pending_verification` are reserved for a future
 * in-flow payment step; money currently moves on the package-purchase side,
 * so a booking only ever goes approval → confirmed. `declined` is the coach
 * turning a request down; `cancelled` is the client calling a booking off.
 */
export type BookingStatus =
  | "pending_approval"
  | "pending_payment"
  | "pending_verification"
  | "confirmed"
  | "completed"
  | "declined"
  | "cancelled";

export type BookingParty = "client" | "coach";

/** A single training session, in any stage from request to completed/cancelled. */
export const booking = pgTable(
  "booking",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    clientId: text("client_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    coachId: text("coach_id")
      .notNull()
      .references(() => coachProfile.id, { onDelete: "restrict" }),
    type: text("type").$type<SessionType>().notNull(),
    location: text("location").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    durationMin: integer("duration_min").notNull(),
    /** The purchase this session draws from. Null for a free consult. */
    packagePurchaseId: text("package_purchase_id").references(
      () => packagePurchase.id,
      { onDelete: "set null" },
    ),
    status: text("status").$type<BookingStatus>().notNull(),
    /** Free-text "anything I should know?" from the client at request time. */
    clientNote: text("client_note"),
    /** Coach's notes, written after the session (past bookings only). */
    sessionNotes: text("session_notes"),
    /** Client's own post-session reflection (past bookings only). */
    clientReflection: text("client_reflection"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: text("cancelled_by").$type<BookingParty>(),
    /** A coach's note to the client when they cancel. */
    cancelReason: text("cancel_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("booking_clientId_idx").on(table.clientId),
    index("booking_coachId_idx").on(table.coachId),
    index("booking_startsAt_idx").on(table.startsAt),
    check(
      "booking_cancelled_by_check",
      sql`${table.cancelledBy} is null or ${table.cancelledBy} in ('client', 'coach')`,
    ),
  ],
);

export type BookingProposalStatus = "pending" | "accepted" | "declined" | "withdrawn";

/**
 * A request to move a confirmed booking to `startsAt`, which the other party
 * accepts or declines; the booking keeps its time until then. A `pending`
 * proposal whose time (or whose booking's time) has passed has lapsed —
 * derived, never written.
 */
export const bookingProposal = pgTable(
  "booking_proposal",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    bookingId: text("booking_id")
      .notNull()
      .references(() => booking.id, { onDelete: "cascade" }),
    /** The proposed start; the duration follows the booking. */
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    proposedBy: text("proposed_by").$type<BookingParty>().notNull(),
    status: text("status").$type<BookingProposalStatus>().notNull().default("pending"),
    /** Optional reason given with a decline. */
    responseNote: text("response_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (table) => [
    index("booking_proposal_bookingId_idx").on(table.bookingId),
    uniqueIndex("booking_proposal_one_pending_uidx")
      .on(table.bookingId)
      .where(sql`${table.status} = 'pending'`),
    check(
      "booking_proposal_status_check",
      sql`${table.status} in ('pending', 'accepted', 'declined', 'withdrawn')`,
    ),
    check("booking_proposal_proposed_by_check", sql`${table.proposedBy} in ('client', 'coach')`),
  ],
);

export const bookingProposalRelations = relations(bookingProposal, ({ one }) => ({
  booking: one(booking, {
    fields: [bookingProposal.bookingId],
    references: [booking.id],
  }),
}));

export const bookingRelations = relations(booking, ({ one, many }) => ({
  proposals: many(bookingProposal),
  client: one(user, {
    fields: [booking.clientId],
    references: [user.id],
  }),
  coach: one(coachProfile, {
    fields: [booking.coachId],
    references: [coachProfile.id],
  }),
  packagePurchase: one(packagePurchase, {
    fields: [booking.packagePurchaseId],
    references: [packagePurchase.id],
  }),
}));
