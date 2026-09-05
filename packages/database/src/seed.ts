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
  sessionLedgerEntry,
  invoice,
  intakeResponse,
  progressEntry,
  measurement,
  chatMessage,
  type UserRole,
  type UserStatus,
  type SessionType,
  type BookingStatus,
  type SessionLedgerReason,
} from "./schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set");

const db = createDb(DATABASE_URL);

const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  baseURL: process.env.AUTH_BASE_URL ?? "http://localhost:4322",
  secret: process.env.BETTER_AUTH_SECRET,
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
const NOW = new Date();
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
  await db.delete(sessionLedgerEntry);
  await db.delete(invoice);
  await db.delete(booking);
  await db.delete(packagePurchase);
  await db.delete(availabilitySlot);
  await db.delete(packageOffering);
  await db.delete(coachProfile);
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

/** Coach-authored packages: N sessions of a fixed length, priced per session. */
const PACKAGES = [
  // ishita
  { key: "ishita-discover", coachKey: "ishita", name: "discover", sessionCount: 1, sessionLengthMin: 60, pricePerSessionCents: 9500, validityDays: 30, description: "one session to see how we work together" },
  { key: "ishita-build", coachKey: "ishita", name: "build", sessionCount: 5, sessionLengthMin: 60, pricePerSessionCents: 8800, validityDays: 90, description: "five sessions to get a programme going" },
  { key: "ishita-transform", coachKey: "ishita", name: "transform", sessionCount: 10, sessionLengthMin: 60, pricePerSessionCents: 8000, validityDays: 120, description: "ten sessions — the full progression" },
  { key: "ishita-deepdive", coachKey: "ishita", name: "deep dive", sessionCount: 3, sessionLengthMin: 90, pricePerSessionCents: 13000, validityDays: 90, description: "three 90-minute sessions — assessments or two focuses" },
  // nadia
  { key: "nadia-starter", coachKey: "nadia", name: "starter", sessionCount: 3, sessionLengthMin: 60, pricePerSessionCents: 9000, validityDays: 60, description: "ease in over three sessions" },
  { key: "nadia-rebuild", coachKey: "nadia", name: "rebuild", sessionCount: 8, sessionLengthMin: 60, pricePerSessionCents: 8200, validityDays: 120, description: "eight sessions to rebuild strength and control" },
  // jolene
  { key: "jolene-kickstart", coachKey: "jolene", name: "kickstart", sessionCount: 4, sessionLengthMin: 60, pricePerSessionCents: 7500, validityDays: 60, description: "four online sessions to build a habit" },
  { key: "jolene-momentum", coachKey: "jolene", name: "momentum", sessionCount: 12, sessionLengthMin: 60, pricePerSessionCents: 6800, validityDays: 180, description: "twelve sessions for consistency through a busy stretch" },
] as const;

const pkgByKey = (key: string) => {
  const p = PACKAGES.find((x) => x.key === key);
  if (!p) throw new Error(`seed: no package ${key}`);
  return p;
};

const sgd = (cents: number) => `sg$${(cents / 100).toFixed(2)}`;

/** N days after `from`, as a real instant. */
const daysAfter = (from: Date, n: number) =>
  new Date(from.getTime() + n * 86_400_000);

/**
 * A client's purchase of a package. `used` / `returned` are historical ledger
 * movements not tied to a seeded booking; booking-linked consumption is added
 * later, per booking. Balances must stay ≥ 0.
 */
const PURCHASES = [
  // an older transform, since expired with 1 session left — history for the activity log
  { key: "tessa-transform-1", clientKey: "tessa", pkgKey: "ishita-transform", purchasedAt: day(-160, "10:00"), used: 9, returned: 0 },
  { key: "tessa-transform", clientKey: "tessa", pkgKey: "ishita-transform", purchasedAt: day(-24, "10:00"), used: 1, returned: 1 },
  { key: "tessa-starter", clientKey: "tessa", pkgKey: "nadia-starter", purchasedAt: day(-6, "10:00"), used: 0, returned: 0 },
  { key: "tessa-kickstart", clientKey: "tessa", pkgKey: "jolene-kickstart", purchasedAt: day(-75, "10:00"), used: 3, returned: 0 },
  // near-expiry: 60-day validity, bought ~48 days ago → exercises Phase 3's date cap
  { key: "farah-kickstart", clientKey: "farah", pkgKey: "jolene-kickstart", purchasedAt: day(-48, "10:00"), used: 1, returned: 0 },
  { key: "renee-build", clientKey: "renee", pkgKey: "ishita-build", purchasedAt: day(-3, "10:00"), used: 0, returned: 0 },
  { key: "hana-build", clientKey: "hana", pkgKey: "ishita-build", purchasedAt: day(-20, "10:00"), used: 2, returned: 0 },
  { key: "yasmin-rebuild", clientKey: "yasmin", pkgKey: "nadia-rebuild", purchasedAt: day(-30, "10:00"), used: 3, returned: 0 },
] as const;

type BookingSeed = {
  clientKey: string;
  coachKey: string;
  type: SessionType;
  location: string;
  startsAt: Date;
  status: BookingStatus;
  /** Purchase the session draws from (pending_approval / confirmed / completed). */
  purchaseKey?: string;
  clientNote?: string;
  clientReflection?: string;
};

const BOOKINGS: BookingSeed[] = [
  // day(9) is comfortably >24h out (reschedule / cancel-with-return);
  // day(1) is in the past now (completed-ish, exercises the past tab).
  { clientKey: "tessa", coachKey: "ishita", type: "1:1 in-person", location: "anytime fitness, meyer rd", startsAt: day(9, "07:30"), status: "confirmed", purchaseKey: "tessa-transform" },
  { clientKey: "tessa", coachKey: "ishita", type: "assessment", location: "anytime fitness, meyer rd", startsAt: day(11, "09:00"), status: "confirmed", purchaseKey: "tessa-transform" },
  { clientKey: "tessa", coachKey: "nadia", type: "1:1 in-person", location: "virgin active, raffles pl", startsAt: day(8, "12:00"), status: "pending_approval", purchaseKey: "tessa-starter", clientNote: "niggling left knee this week — happy to swap lunges" },
  { clientKey: "tessa", coachKey: "ishita", type: "1:1 in-person", location: "anytime fitness, meyer rd", startsAt: day(-3, "07:30"), status: "completed", purchaseKey: "tessa-transform", clientReflection: "felt strong — added 5kg on the trap bar deadlift and knee held up fine." },
  { clientKey: "tessa", coachKey: "ishita", type: "1:1 in-person", location: "anytime fitness, meyer rd", startsAt: day(-7, "07:30"), status: "completed", purchaseKey: "tessa-transform" },
  { clientKey: "tessa", coachKey: "jolene", type: "1:1 online", location: "video call", startsAt: day(-11, "19:30"), status: "completed", purchaseKey: "tessa-kickstart" },
  // Other clients — populate the trainer/admin tables.
  { clientKey: "renee", coachKey: "ishita", type: "1:1 in-person", location: "anytime fitness, meyer rd", startsAt: day(2, "07:30"), status: "pending_approval", purchaseKey: "renee-build", clientNote: "first session after the consult call!" },
  { clientKey: "hana", coachKey: "ishita", type: "assessment", location: "anytime fitness, meyer rd", startsAt: day(5, "09:00"), status: "confirmed", purchaseKey: "hana-build" },
  { clientKey: "farah", coachKey: "jolene", type: "1:1 online", location: "video call", startsAt: day(5, "19:30"), status: "confirmed", purchaseKey: "farah-kickstart" },
  { clientKey: "yasmin", coachKey: "nadia", type: "1:1 in-person", location: "anytime fitness, meyer rd", startsAt: day(-1, "10:30"), status: "completed", purchaseKey: "yasmin-rebuild" },
];

async function seed() {
  console.log("seeding users…");
  const uid = await upsertUsers();

  console.log("wiping domain tables…");
  await wipeDomainTables();

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

  console.log("seeding packages…");
  const pkgIds: Record<string, string> = {};
  for (const p of PACKAGES) {
    const row = one(
      await db
        .insert(packageOffering)
        .values({
          coachId: pick(coachIds, p.coachKey),
          name: p.name,
          description: p.description,
          sessionCount: p.sessionCount,
          sessionLengthMin: p.sessionLengthMin,
          pricePerSessionCents: p.pricePerSessionCents,
          validityDays: p.validityDays,
          active: true,
        })
        .returning({ id: packageOffering.id }),
      `package ${p.key}`,
    );
    pkgIds[p.key] = row.id;
  }

  console.log("seeding package purchases + session ledger…");
  const purchaseIds: Record<string, string> = {};
  for (const p of PURCHASES) {
    const pkg = pkgByKey(p.pkgKey);
    const row = one(
      await db
        .insert(packagePurchase)
        .values({
          clientId: pick(uid, p.clientKey),
          packageId: pick(pkgIds, p.pkgKey),
          purchasedAt: p.purchasedAt,
          pricePaidCents: pkg.sessionCount * pkg.pricePerSessionCents,
          sessionsGranted: pkg.sessionCount,
          sessionLengthMin: pkg.sessionLengthMin,
          expiresAt: daysAfter(p.purchasedAt, pkg.validityDays),
        })
        .returning({ id: packagePurchase.id }),
      `purchase ${p.key}`,
    );
    purchaseIds[p.key] = row.id;

    const entries: {
      delta: number;
      reason: SessionLedgerReason;
      description: string;
      at: Date;
    }[] = [
      {
        delta: pkg.sessionCount,
        reason: "purchase",
        description: `${pkg.name} purchased · ${sgd(pkg.sessionCount * pkg.pricePerSessionCents)}`,
        at: p.purchasedAt,
      },
    ];
    for (let i = 0; i < p.used; i++) {
      entries.push({
        delta: -1,
        reason: "session_consumed",
        description: "session completed",
        at: daysAfter(p.purchasedAt, (i + 1) * 4),
      });
    }
    for (let i = 0; i < p.returned; i++) {
      entries.push({
        delta: 1,
        reason: "returned_in_time",
        description: "cancelled in time · session returned",
        at: daysAfter(p.purchasedAt, 6),
      });
    }
    for (const e of entries) {
      await db.insert(sessionLedgerEntry).values({
        clientId: pick(uid, p.clientKey),
        purchaseId: row.id,
        delta: e.delta,
        reason: e.reason,
        description: e.description,
        createdAt: e.at,
      });
    }
  }

  console.log("seeding invoices…");
  const kick = pkgByKey("jolene-kickstart");
  const momentum = pkgByKey("jolene-momentum");
  const nadStarter = pkgByKey("nadia-starter");
  await db.insert(invoice).values([
    { number: "bwh-0061", clientId: pick(uid, "tessa"), description: "transform · 10 sessions", amountCents: 80000, method: "visa ···· 4242", status: "paid", issuedAt: day(-160, "10:00"), purchaseId: pick(purchaseIds, "tessa-transform-1") },
    { number: "bwh-0140", clientId: pick(uid, "tessa"), description: "kickstart · 4 sessions", amountCents: kick.sessionCount * kick.pricePerSessionCents, method: "paynow · verified", status: "paid", issuedAt: day(-75, "10:00"), purchaseId: pick(purchaseIds, "tessa-kickstart") },
    { number: "bwh-0171", clientId: pick(uid, "tessa"), description: "transform · 10 sessions", amountCents: 80000, method: "paynow · verified", status: "paid", issuedAt: day(-24, "10:00"), purchaseId: pick(purchaseIds, "tessa-transform") },
    { number: "bwh-0178", clientId: pick(uid, "farah"), description: "kickstart · 4 sessions", amountCents: kick.sessionCount * kick.pricePerSessionCents, method: "paynow · verified", status: "paid", issuedAt: day(-48, "10:00"), purchaseId: pick(purchaseIds, "farah-kickstart") },
    { number: "bwh-0182", clientId: pick(uid, "tessa"), description: "starter · 3 sessions", amountCents: 27000, method: "visa ···· 4242", status: "paid", issuedAt: day(-6, "10:00"), purchaseId: pick(purchaseIds, "tessa-starter") },
    // Pending package purchases — awaiting Phase 9 verification (no sessions granted yet).
    { number: "bwh-0186", clientId: pick(uid, "tessa"), description: `${momentum.name} · ${momentum.sessionCount} sessions`, amountCents: momentum.sessionCount * momentum.pricePerSessionCents, method: "paynow · awaiting verification", status: "pending", issuedAt: day(-1, "18:00"), packageId: pick(pkgIds, "jolene-momentum") },
    { number: "bwh-0187", clientId: pick(uid, "declan"), description: `${nadStarter.name} · ${nadStarter.sessionCount} sessions`, amountCents: nadStarter.sessionCount * nadStarter.pricePerSessionCents, method: "paynow · awaiting verification", status: "pending", issuedAt: day(-1, "20:00"), packageId: pick(pkgIds, "nadia-starter") },
  ]);

  console.log("seeding bookings…");
  for (const b of BOOKINGS) {
    const purchasePkgKey = b.purchaseKey
      ? PURCHASES.find((x) => x.key === b.purchaseKey)?.pkgKey
      : undefined;
    const durationMin =
      b.type === "free consult"
        ? 30
        : purchasePkgKey
          ? pkgByKey(purchasePkgKey).sessionLengthMin
          : 60;

    const row = one(
      await db
        .insert(booking)
        .values({
          clientId: pick(uid, b.clientKey),
          coachId: pick(coachIds, b.coachKey),
          type: b.type,
          location: b.location,
          startsAt: b.startsAt,
          durationMin,
          packagePurchaseId: b.purchaseKey ? pick(purchaseIds, b.purchaseKey) : null,
          status: b.status,
          clientNote: b.clientNote ?? null,
          clientReflection: b.clientReflection ?? null,
        })
        .returning({ id: booking.id }),
      `booking ${b.clientKey}/${b.coachKey}`,
    );

    // A confirmed / completed session has drawn one from the purchase.
    if (b.purchaseKey && (b.status === "confirmed" || b.status === "completed")) {
      await db.insert(sessionLedgerEntry).values({
        clientId: pick(uid, b.clientKey),
        purchaseId: pick(purchaseIds, b.purchaseKey),
        bookingId: row.id,
        delta: -1,
        reason: "session_consumed",
        description: `${b.type} · ${b.coachKey}`,
        // Consumed when the coach approved — for a future session that's ~now, not the session date.
        createdAt: b.startsAt < NOW ? b.startsAt : day(-1),
      });
    }
  }

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
    body: "hi! i can help with packages, sessions, cancellations, locations and how booking works. what do you need?",
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
