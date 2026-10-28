import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  boolean,
  date,
  timestamp,
  index,
  uniqueIndex,
  check,
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
    /** Where this coach trains clients, e.g. ["meyer road", "cbd", "online"]. */
    locations: text("locations").array().notNull().default([]),
    /**
     * IANA zone the coach lives/works in. `availability_slot` minutes are
     * wall-clock in this zone. A client in a different zone can only book
     * online session types. Coach-facing editor is Phase 9.
     */
    timezone: text("timezone").notNull().default("Asia/Singapore"),
    coachingSince: integer("coaching_since"),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("availability_slot_coachId_idx").on(table.coachId)],
);

/** `closed` takes time off the weekly hours; `open` adds hours they don't normally have. */
export type AvailabilityExceptionKind = "closed" | "open";

/**
 * A one-off change to a coach's weekly hours — "off 24–31 dec", "open this
 * sunday morning". Applies `start_min`–`end_min` on every date from
 * `start_date` to `end_date` (inclusive); 0–1440 is the whole day. Dates and
 * minutes are wall-clock in the coach's zone, like `availability_slot`. Slot
 * generation adds `open` hours to the day's windows, then removes `closed`
 * ones, so time off wins where they overlap. Existing bookings are never
 * changed by an exception.
 */
export const availabilityException = pgTable(
  "availability_exception",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    coachId: text("coach_id")
      .notNull()
      .references(() => coachProfile.id, { onDelete: "cascade" }),
    kind: text("kind").$type<AvailabilityExceptionKind>().notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    startMin: integer("start_min").notNull(),
    endMin: integer("end_min").notNull(),
    /** Optional label for the coach, e.g. "holiday". */
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("availability_exception_coachId_endDate_idx").on(table.coachId, table.endDate),
    check("availability_exception_kind_check", sql`${table.kind} in ('closed', 'open')`),
    check("availability_exception_dates_check", sql`${table.endDate} >= ${table.startDate}`),
    check(
      "availability_exception_minutes_check",
      sql`${table.startMin} >= 0 and ${table.endMin} <= 1440 and ${table.startMin} < ${table.endMin}`,
    ),
  ],
);

export const coachProfileRelations = relations(coachProfile, ({ one, many }) => ({
  user: one(user, {
    fields: [coachProfile.userId],
    references: [user.id],
  }),
  availability: many(availabilitySlot),
  availabilityExceptions: many(availabilityException),
}));

export const availabilityExceptionRelations = relations(availabilityException, ({ one }) => ({
  coach: one(coachProfile, {
    fields: [availabilityException.coachId],
    references: [coachProfile.id],
  }),
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
