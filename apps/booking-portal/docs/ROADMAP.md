# Booking Portal — Iterative Roadmap

Source of truth for the target product: the Claude Design prototype [**"Booking Portal"**](`https://claude.ai/design/p/785a988f-9a45-490a-9793-bb450e098596`). That file is a static,
click-through mock covering all three roles (client / trainer / admin) with placeholder data —
nothing in it is wired to a database or auth. This doc breaks it down into buildable phases for
the real app in `apps/booking-portal`, ordered so each phase ships something usable before the
next one starts.

Status is based on reading the current code (`apps/booking-portal/src`, `packages/database/src`)
and git history, not assumptions — re-check before trusting a ✅ if much time has passed.

**Legend:** ✅ done · 🚧 partial · ⬜ not started

### About the estimates

Hours assume **AI-assisted development** (a developer working with Claude Code or similar,
steering and reviewing rather than hand-typing everything) — not unattended autonomous work and
not traditional from-scratch estimates. They're focused dev-effort hours, not calendar time.
Later phases are estimated faster than they'd otherwise be because schema shapes, form patterns,
and the checkout-modal skeleton get established early and reused. The riskiest line item to
underestimate is real availability/slot computation in Phase 3 — everything downstream depends
on it being correct, and it's the one piece with actual scheduling-logic complexity rather than
CRUD-and-render.

---

## Phase 0 — Foundations ✅ done

- ✅ Turborepo monorepo, bun workspaces, shared `@repo/ui`, `@repo/tailwind-config`,
  `@repo/typescript-config`, `@repo/eslint-config`
- ✅ `builtwithhabit` daisyUI theme applied across apps
- ✅ `@repo/database`: Drizzle + Postgres connection, better-auth server/client instances
- ✅ `apps/booking-portal` scaffolded on SvelteKit 5 (runes) + Tailwind v4 + daisyUI, dev on
  port 4322
- ✅ Email/password auth via better-auth: combined login/signup page at `/`
  (`src/routes/+page.svelte` + `+page.server.ts`, `?/login` / `?/signup` form actions, zod
  validation)
- ✅ Route protection in `src/hooks.server.ts` — unauthenticated → redirected off `/dashboard`,
  authenticated → redirected off `/`
- ✅ DB schema was **auth-only** at end of Phase 0: `user`, `session`, `account`, `verification`
  (`packages/database/src/schema/auth.ts`) — no `role` column, no domain tables (all added in Phase 1)
- ✅ `/dashboard` exists but is a literal placeholder (`<!-- TODO: Update. This is a placeholder
  dashboard page -->`) — just a welcome message and a logout button

Everything below is ⬜ not started unless marked otherwise.

---

## Phase 1 — Data model & roles ✅ done
**Estimate: ~6h**

Prerequisite for everything else — the prototype has no real backing data, so this phase defines
the schema the rest of the roadmap fills in.

- ✅ `role` (`client` | `trainer` | `admin`, default `client`) + `status` (`active` | `invited`)
  on `user`, wired through better-auth `additionalFields` so they land in the session /
  `App.Locals` (`packages/database/src/schema/auth.ts`, `auth/server.ts`)
- ✅ Domain tables in `packages/database/src/schema/` split by concern:
  `coaching.ts` (`coach_profile`, `availability_slot` — recurring weekly open windows),
  `booking.ts` (`booking`), `billing.ts` (`package`, `package_purchase`, `credit_ledger_entry`
  with a signed `numeric` delta, `invoice`), `health.ts` (`intake_response`, `progress_entry`,
  `measurement`), `messaging.ts` (`chat_message`). Migration `0001_windy_bromley`.
  `coach_profile` is decoupled from `role` on purpose — Ishita is an admin who also coaches.
- ✅ Role-based route guards in `hooks.server.ts`: shared surfaces need any session;
  `/trainer/*` is trainer+admin, `/admin/*` is admin-only; wrong-role access → role's home.
  (`HOME_BY_ROLE` all point at `/dashboard` until the trainer/admin route trees exist.)
- ✅ Seed script (`bun run db:seed`, `packages/database/src/seed.ts`) — mirrors the prototype:
  Ishita/Nadia/Jolene coaches, Tessa as the worked-example client (transform package, 6 credits,
  bookings, progress, measurements, completed PAR-Q), plus Renee/Farah/Declan/Hana/Yasmin.
  All seed users log in with password `password`. Idempotent (upserts users, wipes+reinserts
  domain tables).

## Phase 2 — Client dashboard shell & navigation ✅ done
**Estimate: ~5h**

*Design screens: global sidebar, "Client dashboard"*

- ✅ Replace the placeholder `/dashboard` with the real app shell: role-aware sidebar nav
  (dashboard / bookings / packages / payments / progress / help), logout — *2h*
- ✅ Dashboard content: today label, "hey {name}", stat cards, "what's next" (upcoming bookings
  preview), credits summary card, weekly focus — can start with data read from Phase 1 tables
  even before booking creation exists (empty states are fine) — *3h*

## Phase 3 — Coach directory & booking request (client) ⬜
**Estimate: ~10h** (highest-risk phase to underestimate)

*Design screens: "Bookings" → choose coach, coach profile / book panel*

- Coach list: search, speciality/location filter chips, sort (soonest / most open slots /
  price / name) — *2.5h*
- Coach profile panel: bio, rate, hours, tags, shareable link — *1.5h*
- Booking form: session type, duration, date (next N days from real availability), time slot
  (blocked out where already booked) → creates a `booking` row with `pending_payment` or
  `pending_approval` status — *3h*
- Real availability computation reading `availability_slot` / `booking` tables (slot generation,
  conflict blocking) — this is the crux of the whole app, budget contingency here — *3h*
- ✅ **Timezone:** every `timestamp` column is now `timestamptz` (migration
  `0002_high_impossible_man`), the seed writes real instants from SGT wall-clock times
  (`day()` / literals carry a `+08:00` offset), and the client dashboard renders client-side
  (`+page.ts` `ssr = false`) so times show in the **viewer's** local timezone. Slot computation
  still needs to treat `availability_slot` (minutes-from-midnight) as SGT and convert to instants.

## Phase 4 — Checkout & payments (client) ⬜
**Estimate: ~6h** (PayNow only) **+ ~2h** (Stripe, deferred)

*Design screen: checkout modal (review → pay → waiting/confirmed)*

- Checkout modal shell: review → pay → waiting/confirmed steps — *2h*
- PayNow flow (QR + screenshot upload, `pending_verification` status) — *2.5h*
- On confirmation: decrement credit ledger or mark invoice paid, flip booking to `confirmed`,
  toast/notification — *1.5h*
- Stripe card flow — *2h, defer until PayNow path is proven end-to-end*

## Phase 5 — Bookings management (client) ⬜
**Estimate: ~5.5h**

*Design screen: "Bookings" list, upcoming/past/all tabs*

- List view with tabs — *1.5h*
- Per-row actions: pay to confirm, reschedule, cancel, session notes (past only) — *2.5h*
- Cancellation policy: >24h before session → credit refunded to ledger; <24h → credit consumed
  (hardcode 24h until Phase 10's admin settings exist) — *1.5h*

## Phase 6 — Packages, credits & invoices (client) ⬜
**Estimate: ~5.5h**

*Design screens: "Packages & credits", "Payments"*

- Active package card (credit pips, expiry) + credit activity log — *2h*
- "Top up" package cards reusing the Phase 4 checkout modal — *1h*
- Payments page: stats, invoice table, saved payment methods, cancellation policy blurb — *2.5h*

## Phase 7 — Intake / PAR-Q health screening ⬜
**Estimate: ~4.5h**

*Design screen: "Intake PAR-Q"*

- Multi-step form (progress bar, PAR-Q questions) — *2.5h*
- Gate a client's first confirmed session on completion; scope visibility to client + assigned
  coach only (PDPA — don't surface to admin by default) — *2h*

## Phase 8 — Progress tracking (client) ⬜
**Estimate: ~7.5h**

*Design screen: "Progress"*

- Stat tiles, chart with metric tabs, backed by `progress_entry` — *2.5h*
- Measurements list, "log this week's numbers" entry form — *2h*
- Check-in photos — private storage (client + assigned coach only) — *3h*

## Phase 9 — Trainer (coach) portal ⬜
**Estimate: ~9h**

*Design screens: "Trainer dashboard", "Trainer clients"*

- Dashboard: today's schedule, pending requests (approve / suggest another time — approve flips
  booking to confirmed), payments-to-verify queue (PayNow screenshots from Phase 4) — *3.5h*
- Weekly availability grid: tap to toggle open/closed; booked cells derived from real bookings,
  not manually set — *3h*
- Clients table: roster with credits, next session, attendance %, flags — derived (credits low /
  no screening / etc.), not manually set — *2.5h*

## Phase 10 — Admin portal ⬜
**Estimate: ~8h** **+ ~2h** ("preview as", deferred)

*Design screens: "Admin overview", "Admin users"*

- Overview: revenue by coach, utilization, all-bookings table — *3h*
- Package pricing editor, cancellation-policy / credit-expiry settings (becomes the real source
  for Phase 5's 24h rule and Phase 6/9 expiry) — *2h*
- Users: role management (client/trainer/admin), invite flow, audit log of role changes — *3h*
- "Preview as" mode (admin viewing the app as a client/trainer) — *2h, defer until the client and
  trainer surfaces are stable, since it just re-renders them with a banner*

## Phase 11 — Help / support ⬜
**Estimate: ~3h** (canned) **+ ~4-6h** (real AI assistant, deferred)

*Design screen: "Help and support"*

- Chat UI backed by `chat_message`, canned/FAQ-suggestion responses — *2.5h*
- Escalate-to-coach and WhatsApp link (static, just needs the coach's real contact info) — *0.5h*
- Real AI assistant grounded on FAQs + account data — *4-6h, highest-effort/lowest-priority piece
  of the mock, defer*

## Phase 12 — Polish & hardening ⬜
**Estimate: ~16h**, spread across the project rather than a single sprint

- Complete Stripe integration (builds on the Phase 4 stub) — *2h*
- Email/SMS reminders for upcoming sessions and pending approvals — *3h*
- Notifications/toasts wired to real events (booking confirmed, payment verified, etc.) — *2h*
- Accessibility and responsive pass against the prototype's breakpoints — *3h*
- Test coverage for booking/credit/cancellation logic (real money and scheduling correctness at
  stake) — *4h*
- Production deploy pipeline — *2h*

---

## Suggested near-term order

Phase 1 → 2 → 3 → 4 → 5 is the critical path: it turns the placeholder dashboard into a working
booking loop (browse coach → request → pay → see it in bookings) before touching packages,
progress, trainer tools, or admin — roughly **~33h** of AI-assisted effort. Phases 6–11 can then
proceed in roughly the listed order, or be reprioritized based on which role (client vs. coach
vs. admin) needs to go live first.

## Total estimated effort

| Scope | Estimate |
| :-- | :-- |
| Critical path (Phases 1–5) | ~33h |
| Full client + trainer + admin core (Phases 1–11, excluding deferred items) | ~70h |
| Deferred items (Stripe, real AI assistant, "preview as") | ~8-10h |
| Polish & hardening (Phase 12) | ~16h |
| **End-to-end** | **~95-105h**, i.e. roughly 2.5-3 weeks of focused solo AI-assisted work |

Treat these as planning inputs, not commitments — re-estimate each phase once Phase 1's schema is
locked in, since it's the foundation everything else measures against.
