import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  numeric,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createId } from "./id";
import { user } from "./auth";
import { coachProfile } from "./coaching";

export type SessionType =
  | "1:1 in-person"
  | "1:1 online"
  | "free consult"
  | "assessment";

export type BookingStatus =
  | "pending_approval"
  | "pending_payment"
  /** Paynow screenshot submitted, awaiting a coach/admin to verify it (Phase 9). */
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
    /** Credits this session costs: 45min → 0.75, 60min → 1, 90min → 1.5. */
    creditCost: numeric("credit_cost", { precision: 4, scale: 2 }).notNull(),
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
}));
