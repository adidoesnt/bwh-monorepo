import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  numeric,
  boolean,
  jsonb,
  date,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createId } from "./id";
import { user } from "./auth";
import { coachProfile } from "./coaching";

/**
 * PAR-Q health screening + goals/history + consent. One per client. Visibility
 * is scoped to the client and their assigned coach only — not surfaced to admins
 * by default (PDPA).
 */
export const intakeResponse = pgTable(
  "intake_response",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    clientId: text("client_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Coach allowed to view this screening. */
    coachId: text("coach_id").references(() => coachProfile.id, {
      onDelete: "set null",
    }),
    /** Map of PAR-Q question index → answer, e.g. { "0": false, "3": true }. */
    parqAnswers: jsonb("parq_answers").$type<Record<string, boolean>>().notNull(),
    /** True when any PAR-Q answer is "yes" — gates on doctor's clearance. */
    parqFlag: boolean("parq_flag").notNull(),
    goals: text("goals").array().notNull().default([]),
    trainingExperience: text("training_experience"),
    injuriesText: text("injuries_text"),
    weeklyTarget: text("weekly_target"),
    signature: text("signature"),
    consentAt: timestamp("consent_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [uniqueIndex("intake_response_clientId_uidx").on(table.clientId)],
);

/** A dated data point for a tracked training metric (squat 1RM, sessions/week, …). */
export const progressEntry = pgTable(
  "progress_entry",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    clientId: text("client_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Metric key, e.g. "squat_1rm", "rdl_working", "sessions_per_week". */
    metric: text("metric").notNull(),
    recordedOn: date("recorded_on").notNull(),
    value: numeric("value", { precision: 8, scale: 2 }).notNull(),
    unit: text("unit"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("progress_entry_clientId_metric_idx").on(table.clientId, table.metric),
  ],
);

/** A dated body measurement (weight, waist, hips, thigh, resting HR, …). */
export const measurement = pgTable(
  "measurement",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    clientId: text("client_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** e.g. "weight", "waist", "hips", "thigh", "resting_hr". */
    kind: text("kind").notNull(),
    takenOn: date("taken_on").notNull(),
    value: numeric("value", { precision: 8, scale: 2 }).notNull(),
    unit: text("unit"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("measurement_clientId_kind_idx").on(table.clientId, table.kind),
  ],
);

export const intakeResponseRelations = relations(intakeResponse, ({ one }) => ({
  client: one(user, {
    fields: [intakeResponse.clientId],
    references: [user.id],
  }),
  coach: one(coachProfile, {
    fields: [intakeResponse.coachId],
    references: [coachProfile.id],
  }),
}));

export const progressEntryRelations = relations(progressEntry, ({ one }) => ({
  client: one(user, {
    fields: [progressEntry.clientId],
    references: [user.id],
  }),
}));

export const measurementRelations = relations(measurement, ({ one }) => ({
  client: one(user, {
    fields: [measurement.clientId],
    references: [user.id],
  }),
}));
