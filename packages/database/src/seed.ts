/**
 * Local-dev seed. Mirrors the "Booking Portal" prototype's mock data:
 * Ishita as founder-coach, Nadia and Jolene as coaches, Tessa as the worked
 * example client (transform package, bookings, progress, intake), plus a few
 * more clients so the trainer/admin tables have rows.
 *
 * Run from the repo root: `bun run db:seed`
 * Wipes every domain table (not the auth tables) and re-inserts. Users are
 * upserted by email, so existing logins keep working.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import { createDb } from "./db";
import schema from "./schema";
import {
  user,
  coachProfile,
  availabilitySlot,
  booking,
  packageOffering,
  packagePurchase,
  creditLedgerEntry,
  invoice,
  intakeResponse,
  progressEntry,
  measurement,
  chatMessage,
  type UserRole,
  type UserStatus,
  type SessionType,
  type BookingStatus,
  type CreditReason,
} from "./schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set");

const db = createDb(DATABASE_URL);

const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  baseURL: process.env.AUTH_BASE_URL ?? "http://localhost:4322",
  emailAndPassword: { enabled: true },
});

const SEED_PASSWORD = "password";

/** First row of an insert/update `.returning()`, or throw if nothing came back. */
const one = <T>(rows: T[], what: string): T => {
  const row = rows[0];
  if (row === undefined) throw new Error(`seed: expected a row for ${what}`);
  return row;
};

/** Look up an id built earlier in the run, or throw on a typo'd key. */
const pick = (rec: Record<string, string>, key: string): string => {
  const v = rec[key];
  if (v === undefined) throw new Error(`seed: missing id for "${key}"`);
  return v;
};

/** Singapore is a fixed UTC+8 (no DST) — seed wall-clock times are SGT. */
const SGT = "+08:00";
/** `offset` days from 2026-08-31 (the prototype's "today"), at SGT wall-clock `hhmm`. */
const day = (offset: number, hhmm = "00:00") => {
  const d = new Date(Date.UTC(2026, 7, 31 + offset));
  return new Date(`${d.toISOString().slice(0, 10)}T${hhmm}:00${SGT}`);
};
/** Date string N days after 15 Jun 2026 (Tessa's week-1 baseline). */
const weekDate = (daysAfterJun15: number) => {
  const d = new Date("2026-06-15T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + daysAfterJun15);
  return d.toISOString().slice(0, 10);
};

type SeedUser = {
  key: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
};

const USERS: SeedUser[] = [
  { key: "ishita", name: "Ishita Mahajan", email: "ishita@builtwithhabit.com", role: "admin", status: "active" },
  { key: "owner", name: "BWH Admin", email: "hello@builtwithhabit.com", role: "admin", status: "active" },
  { key: "nadia", name: "Nadia Rahman", email: "nadia@builtwithhabit.com", role: "trainer", status: "active" },
  { key: "jolene", name: "Jolene Lim", email: "jolene@builtwithhabit.com", role: "trainer", status: "active" },
  { key: "tessa", name: "Tessa Lim", email: "tessa@gmail.com", role: "client", status: "active" },
  { key: "renee", name: "Renee Soh", email: "renee.s@gmail.com", role: "client", status: "invited" },
  { key: "farah", name: "Farah Rahim", email: "farah@example.com", role: "client", status: "active" },
  { key: "declan", name: "Declan Koh", email: "declan@example.com", role: "client", status: "active" },
  { key: "hana", name: "Hana Wong", email: "hana@example.com", role: "client", status: "active" },
  { key: "yasmin", name: "Yasmin Devi", email: "yasmin@example.com", role: "client", status: "active" },
];

async function upsertUsers(): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const u of USERS) {
    const existing = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, u.email));

    if (existing.length === 0) {
      await auth.api.signUpEmail({
        body: { email: u.email, password: SEED_PASSWORD, name: u.name },
      });
    }

    const row = one(
      await db
        .update(user)
        .set({
          name: u.name,
          role: u.role,
          status: u.status,
          timezone: "Asia/Singapore",
          emailVerified: true,
        })
        .where(eq(user.email, u.email))
        .returning({ id: user.id }),
      `user ${u.email}`,
    );
    ids[u.key] = row.id;
  }
  return ids;
}

async function wipeDomainTables() {
  // Child-first so foreign keys don't complain.
  await db.delete(chatMessage);
  await db.delete(measurement);
  await db.delete(progressEntry);
  await db.delete(intakeResponse);
  await db.delete(creditLedgerEntry);
  await db.delete(invoice);
  await db.delete(packagePurchase);
  await db.delete(booking);
  await db.delete(availabilitySlot);
  await db.delete(coachProfile);
  await db.delete(packageOffering);
}

/** Weekly open windows, in [startMin, endMin] minutes from midnight. */
const COACHES = [
  {
    userKey: "ishita",
    slug: "ishita",
    speciality: "strength · founder",
    tagline: "progressive strength for women, taught from the ground up",
    bio: "i came to coaching from life sciences, and it shows: no fads, no guesswork. we'll build your programme around progressive resistance training, sustainable nutrition and the body you actually have — then keep it interesting enough that you come back.",
    tags: ["strength", "hypertrophy", "beginners", "nutrition"],
    rateFromCents: 8000,
    locations: ["meyer road", "cbd", "online"],
    timezone: "Asia/Singapore",
    coachingSince: 2023,
    windows: [
      [360, 630],
      [1020, 1230],
    ],
  },
  {
    userKey: "nadia",
    slug: "nadia",
    speciality: "mobility · pre/postnatal",
    tagline: "moving well again — through pregnancy, postpartum and after injury",
    bio: "i work with women rebuilding trust in their bodies. sessions start with what hurts or feels stiff, and we work outward from there: joint control, breathing mechanics, then load. patient, unhurried, and deeply un-scary if the gym intimidates you.",
    tags: ["mobility", "pre/postnatal", "rehab-adjacent", "core"],
    rateFromCents: 8500,
    locations: ["meyer road", "raffles place"],
    timezone: "Asia/Singapore",
    coachingSince: 2021,
    windows: [
      [360, 540],
      [720, 810],
      [1020, 1200],
    ],
  },
  {
    userKey: "jolene",
    slug: "jolene",
    speciality: "conditioning · online",
    tagline: "conditioning and consistency, wherever you are",
    bio: "most of my clients train with me over video, in a condo gym or a hotel one. we build cardio capacity and full-body strength with whatever equipment you've got, and i'm blunt about what actually moves the needle when your week is chaos.",
    tags: ["conditioning", "online", "fat loss", "travel-friendly"],
    rateFromCents: 7500,
    locations: ["online", "east coast"],
    // A deliberately different zone so the cross-timezone (online-only) path is seeded.
    timezone: "Asia/Dubai",
    coachingSince: 2022,
    windows: [
      [420, 540],
      [1080, 1260],
    ],
  },
];

const PACKAGES = [
  { name: "discover", sessionCount: 1, priceCents: 9500 },
  { name: "build", sessionCount: 5, priceCents: 45000 },
  { name: "transform", sessionCount: 10, priceCents: 80000 },
];

const creditCostFor = (durationMin: number) =>
  durationMin === 45 ? "0.75" : durationMin === 90 ? "1.50" : "1.00";

async function seed() {
  console.log("seeding users…");
  const uid = await upsertUsers();

  console.log("wiping domain tables…");
  await wipeDomainTables();

  console.log("seeding packages…");
  const pkgIds: Record<string, string> = {};
  for (const p of PACKAGES) {
    const row = one(
      await db
        .insert(packageOffering)
        .values({ ...p, creditExpiryMonths: 3, active: true })
        .returning({ id: packageOffering.id }),
      `package ${p.name}`,
    );
    pkgIds[p.name] = row.id;
  }

  console.log("seeding coaches + availability…");
  const coachIds: Record<string, string> = {};
  for (const c of COACHES) {
    const row = one(
      await db
        .insert(coachProfile)
        .values({
          userId: pick(uid, c.userKey),
          slug: c.slug,
          speciality: c.speciality,
          tagline: c.tagline,
          bio: c.bio,
          tags: c.tags,
          rateFromCents: c.rateFromCents,
          locations: c.locations,
          timezone: c.timezone,
          coachingSince: c.coachingSince,
          active: true,
        })
        .returning({ id: coachProfile.id }),
      `coach ${c.slug}`,
    );
    coachIds[c.userKey] = row.id;

    // Same weekly windows Monday–Saturday.
    for (let weekday = 1; weekday <= 6; weekday++) {
      for (const [startMin, endMin] of c.windows) {
        await db.insert(availabilitySlot).values({
          coachId: row.id,
          weekday,
          startMin: startMin ?? 0,
          endMin: endMin ?? 0,
        });
      }
    }
  }

  console.log("seeding tessa's package purchase + credit ledger…");
  const transformPurchase = one(
    await db
      .insert(packagePurchase)
      .values({
        clientId: pick(uid, "tessa"),
        packageId: pick(pkgIds, "transform"),
        purchasedAt: new Date("2026-08-12T10:00:00+08:00"),
        pricePaidCents: 80000,
        creditsGranted: 10,
        expiresAt: new Date("2026-11-30T23:59:59+08:00"),
      })
      .returning({ id: packagePurchase.id }),
    "transform purchase",
  );

  const ledger: {
    delta: string;
    reason: CreditReason;
    description: string;
    at: Date;
    purchaseId: string | null;
  }[] = [
    { delta: "10", reason: "purchase", description: "transform purchased · sg$800.00 · card", at: day(-19), purchaseId: transformPurchase.id },
    { delta: "-1", reason: "session_confirmed", description: "session confirmed · ishita · 07:30", at: day(-16), purchaseId: null },
    { delta: "-1", reason: "session_confirmed", description: "session confirmed · ishita · 07:30", at: day(-13), purchaseId: null },
    { delta: "-1", reason: "session_confirmed", description: "session confirmed · ishita · 07:30", at: day(-11), purchaseId: null },
    { delta: "1", reason: "refund_in_time", description: "cancelled in time · credit returned", at: day(-9), purchaseId: null },
    { delta: "-1", reason: "session_confirmed", description: "session confirmed · jolene · 19:30", at: day(-11), purchaseId: null },
    { delta: "-1", reason: "session_confirmed", description: "session confirmed · ishita · 07:30", at: day(-4), purchaseId: null },
  ];
  for (const e of ledger) {
    await db.insert(creditLedgerEntry).values({
      clientId: pick(uid, "tessa"),
      purchaseId: e.purchaseId,
      delta: e.delta,
      reason: e.reason,
      description: e.description,
      createdAt: e.at,
    });
  }

  console.log("seeding farah's near-expiry package…");
  const farahBuild = one(
    await db
      .insert(packagePurchase)
      .values({
        clientId: pick(uid, "farah"),
        packageId: pick(pkgIds, "build"),
        purchasedAt: day(-18, "10:00"),
        pricePaidCents: 45000,
        creditsGranted: 5,
        expiresAt: day(12, "23:59"),
      })
      .returning({ id: packagePurchase.id }),
    "farah build purchase",
  );
  const farahLedger: { delta: string; reason: CreditReason; description: string; at: Date; purchaseId: string | null }[] = [
    { delta: "5", reason: "purchase", description: "build purchased · sg$450.00 · paynow", at: day(-18), purchaseId: farahBuild.id },
    { delta: "-1", reason: "session_confirmed", description: "session confirmed · jolene · 19:30", at: day(-2), purchaseId: null },
  ];
  for (const e of farahLedger) {
    await db.insert(creditLedgerEntry).values({
      clientId: pick(uid, "farah"),
      purchaseId: e.purchaseId,
      delta: e.delta,
      reason: e.reason,
      description: e.description,
      createdAt: e.at,
    });
  }

  console.log("seeding invoices…");
  await db.insert(invoice).values([
    { number: "bwh-0182", clientId: pick(uid, "tessa"), description: "1:1 online · 6 sep", amountCents: 9500, method: "paynow · awaiting verification", status: "pending", issuedAt: day(0) },
    { number: "bwh-0171", clientId: pick(uid, "tessa"), description: "transform · 10 sessions", amountCents: 80000, method: "visa ···· 4242", status: "paid", issuedAt: new Date("2026-08-12T10:00:00+08:00"), purchaseId: transformPurchase.id },
    { number: "bwh-0146", clientId: pick(uid, "tessa"), description: "build · 5 sessions", amountCents: 45000, method: "paynow · verified", status: "paid", issuedAt: new Date("2026-07-04T10:00:00+08:00") },
    { number: "bwh-0121", clientId: pick(uid, "tessa"), description: "discover · 1 session", amountCents: 9500, method: "visa ···· 4242", status: "paid", issuedAt: new Date("2026-06-12T10:00:00+08:00") },
    { number: "bwh-0118", clientId: pick(uid, "tessa"), description: "late cancellation", amountCents: 0, method: "credit used", status: "no_charge", issuedAt: new Date("2026-06-09T10:00:00+08:00") },
  ]);

  console.log("seeding bookings…");
  const bk = (
    clientKey: string,
    coachKey: string,
    type: SessionType,
    location: string,
    startsAt: Date,
    status: BookingStatus,
    durationMin = 60,
    clientNote: string | null = null,
    clientReflection: string | null = null,
  ) => ({
    clientId: pick(uid, clientKey),
    coachId: pick(coachIds, coachKey),
    type,
    location,
    startsAt,
    durationMin,
    creditCost: creditCostFor(durationMin),
    status,
    clientNote,
    clientReflection,
  });

  await db.insert(booking).values([
    // day(9) is comfortably >24h out (reschedule / cancel-with-refund);
    // day(1) is soon (cancel inside the 24h window → credit forfeited).
    bk("tessa", "ishita", "1:1 in-person", "anytime fitness, meyer rd", day(9, "07:30"), "confirmed"),
    bk("tessa", "ishita", "assessment", "anytime fitness, meyer rd", day(1, "09:00"), "confirmed"),
    bk("tessa", "jolene", "1:1 online", "video call", day(6, "19:30"), "pending_payment"),
    bk("tessa", "nadia", "1:1 in-person", "virgin active, raffles pl", day(8, "12:00"), "pending_approval", 60, "niggling left knee this week — happy to swap lunges"),
    bk("tessa", "ishita", "1:1 in-person", "anytime fitness, meyer rd", day(-3, "07:30"), "completed", 60, null, "felt strong — added 5kg on the trap bar deadlift and knee held up fine."),
    bk("tessa", "ishita", "1:1 in-person", "anytime fitness, meyer rd", day(-7, "07:30"), "completed"),
    bk("tessa", "jolene", "1:1 online", "video call", day(-11, "19:30"), "completed"),
    // Other clients — populate the trainer/admin tables.
    bk("renee", "ishita", "1:1 in-person", "anytime fitness, meyer rd", day(2, "07:30"), "pending_approval", 60, "first session after the consult call!"),
    bk("declan", "nadia", "1:1 in-person", "virgin active, raffles pl", day(3, "12:00"), "pending_payment"),
    bk("hana", "ishita", "assessment", "anytime fitness, meyer rd", day(5, "09:00"), "confirmed"),
    bk("farah", "jolene", "1:1 online", "video call", day(5, "19:30"), "confirmed"),
    bk("yasmin", "nadia", "1:1 in-person", "anytime fitness, meyer rd", day(-1, "10:30"), "completed"),
  ]);

  console.log("seeding tessa's intake…");
  await db.insert(intakeResponse).values({
    clientId: pick(uid, "tessa"),
    coachId: pick(coachIds, "ishita"),
    parqAnswers: { "0": false, "1": false, "2": false, "3": true, "4": false, "5": false },
    parqFlag: true,
    goals: ["build strength", "move pain-free"],
    trainingExperience: "some experience, no structure",
    injuriesText:
      "left knee acl repair in 2021, still cautious with deep lunges",
    weeklyTarget: "2 sessions",
    signature: "tessa lim",
    consentAt: new Date("2026-06-11T09:00:00+08:00"),
    submittedAt: new Date("2026-06-11T09:00:00+08:00"),
  });

  console.log("seeding tessa's progress + measurements…");
  const series: Record<string, { unit: string | null; values: number[] }> = {
    squat_1rm: { unit: "kg", values: [42, 45, 45, 50, 52, 55, 57, 62] },
    rdl_working: { unit: "kg", values: [30, 32, 35, 35, 40, 42, 45, 47] },
    sessions_per_week: { unit: null, values: [1, 2, 2, 1, 2, 2, 3, 2] },
  };
  for (const [metric, spec] of Object.entries(series)) {
    for (let week = 0; week < spec.values.length; week++) {
      await db.insert(progressEntry).values({
        clientId: pick(uid, "tessa"),
        metric,
        recordedOn: weekDate(week * 7),
        value: String(spec.values[week] ?? 0),
        unit: spec.unit,
      });
    }
  }

  const measRows: {
    kind: string;
    unit: string;
    week1: number;
    week10: number;
  }[] = [
    { kind: "weight", unit: "kg", week1: 63.2, week10: 61.4 },
    { kind: "waist", unit: "cm", week1: 76.0, week10: 72.0 },
    { kind: "hips", unit: "cm", week1: 98.0, week10: 96.5 },
    { kind: "thigh", unit: "cm", week1: 54.8, week10: 56.2 },
    { kind: "resting_hr", unit: "bpm", week1: 69, week10: 62 },
  ];
  for (const mr of measRows) {
    await db.insert(measurement).values([
      { clientId: pick(uid, "tessa"), kind: mr.kind, unit: mr.unit, takenOn: weekDate(0), value: String(mr.week1) },
      { clientId: pick(uid, "tessa"), kind: mr.kind, unit: mr.unit, takenOn: weekDate(70), value: String(mr.week10) },
    ]);
  }

  console.log("seeding tessa's help thread…");
  await db.insert(chatMessage).values({
    clientId: pick(uid, "tessa"),
    sender: "bot",
    body: "hi! i can help with packages, credits, cancellations, locations and how booking works. what do you need?",
    createdAt: day(-2, "14:00"),
  });

  console.log("done. all seed users log in with password:", SEED_PASSWORD);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
