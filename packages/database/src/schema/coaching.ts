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

/**
 * A bookable coach. Separate from `user.role` on purpose: in the prototype Ishita
 * is an admin who also coaches, so any user can opt into a coach profile
 * regardless of the portal their role lets them into.
 */
export const coachProfile = pgTable(
  "coach_profile",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** URL slug for the shareable page, e.g. `builtwithhabit.com/book/ishita`. */
    slug: text("slug").notNull(),
    /** Short label under the name, e.g. "strength · founder". */
    speciality: text("speciality").notNull(),
    tagline: text("tagline").notNull(),
    bio: text("bio").notNull(),
    tags: text("tags").array().notNull().default([]),
    /** Cheapest session rate, in cents (SG$80 → 8000). */
    rateFromCents: integer("rate_from_cents").notNull(),
    /** Where this coach trains clients, e.g. ["meyer road", "cbd", "online"]. */
    locations: text("locations").array().notNull().default([]),
    coachingSince: integer("coaching_since"),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("coach_profile_userId_uidx").on(table.userId),
    uniqueIndex("coach_profile_slug_uidx").on(table.slug),
  ],
);

/**
 * A recurring weekly window when a coach is open for bookings. Stored as
 * open ranges per weekday; Phase 3 generates concrete slots from these and
 * blocks out cells that already have a `booking`.
 */
export const availabilitySlot = pgTable(
  "availability_slot",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    coachId: text("coach_id")
      .notNull()
      .references(() => coachProfile.id, { onDelete: "cascade" }),
    /** 0 = Sunday … 6 = Saturday, matching JS `Date.getDay()`. */
    weekday: integer("weekday").notNull(),
    /** Minutes from midnight. 06:30 → 390. */
    startMin: integer("start_min").notNull(),
    endMin: integer("end_min").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("availability_slot_coachId_idx").on(table.coachId)],
);

export const coachProfileRelations = relations(coachProfile, ({ one, many }) => ({
  user: one(user, {
    fields: [coachProfile.userId],
    references: [user.id],
  }),
  availability: many(availabilitySlot),
}));

export const availabilitySlotRelations = relations(
  availabilitySlot,
  ({ one }) => ({
    coach: one(coachProfile, {
      fields: [availabilitySlot.coachId],
      references: [coachProfile.id],
    }),
  }),
);
