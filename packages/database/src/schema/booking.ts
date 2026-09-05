import { relations } from "drizzle-orm";
import { pgTable, text, integer, timestamp, index } from "drizzle-orm/pg-core";
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
 * `pending_payment` / `pending_verification` existed in Phases 4–5.5 when
 * payment was part of the booking flow. Phase 6 moved money to the
 * package-purchase side, so a booking is only ever approval → confirmed. Those
 * values may still sit on pre-6 rows; they are never written now.
 */
export type BookingStatus =
  | "pending_approval"
  | "pending_payment"
  | "pending_verification"
  | "confirmed"
  | "completed"
  | "cancelled";

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
  ],
);

export const bookingRelations = relations(booking, ({ one }) => ({
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
