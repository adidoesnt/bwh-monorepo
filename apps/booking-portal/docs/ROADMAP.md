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
  validation). Signup takes first / **optional middle** / last name → stored as one `name`.
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
  *(Phase 5.5 reworks the billing tables: global credits → coach-authored packages,
  `credit_ledger_entry` → `session_ledger_entry`, `coach_profile.rate_from_cents` dropped.)*
- ✅ Role-based route guards in `hooks.server.ts`: shared surfaces need any session;
  `/trainer/*` is trainer+admin, `/admin/*` is admin-only; wrong-role access → role's home.
  (`HOME_BY_ROLE` all point at `/dashboard` until the trainer/admin route trees exist.)
- ✅ Seed script (`bun run db:seed`, `packages/database/src/seed.ts`) — mirrors the prototype:
  Ishita/Nadia/Jolene coaches, Tessa as the worked-example client (transform package, 6 credits,
  bookings, progress, measurements, completed PAR-Q), plus Renee/Farah/Declan/Hana/Yasmin.
  Farah has a `build` package expiring soon and **no** PAR-Q, to exercise Phase 3's date-cap
  and screening gates. All seed users log in with password `password`. Idempotent (upserts
  users, wipes+reinserts domain tables). *(Phase 5.5 rewrites the package/purchase/ledger seed
  data to the coach-packages model.)*

## Phase 2 — Client dashboard shell & navigation ✅ done
**Estimate: ~5h**

*Design screens: global sidebar, "Client dashboard"*

- ✅ Replace the placeholder `/dashboard` with the real app shell: role-aware sidebar nav
  (dashboard / bookings / packages / payments / progress / help), logout — *2h*
- ✅ Dashboard content: today label, "hey {name}", stat cards, "what's next" (upcoming bookings
  preview), credits summary card, weekly focus — data read from Phase 1 tables — *3h*
  *(Phase 5.5: credits card → per-purchase package cards; "weekly focus" (assumed one coach owns
  programming) → "recent activity" feed from `session_ledger_entry`; "what's next" rows deep-link
  to `/bookings?manage=<id>`.)*
- ✅ The whole authenticated app renders lowercase (`lowercase` on the `(app)` layout;
  explicit `uppercase` on leaf labels still wins) — the prototype's house style. Names show
  full in identity spots, first-name-only in prose; currency (`SG$…`) stays uppercased.
- ✅ "request a session" on the dashboard is a live link to `/bookings` (was disabled).

## Phase 2.5 — Timezone foundation ✅ done

Cross-cutting change done between Phase 2 and Phase 3 because Phase 3's slot maths depends on it.

- ✅ Every `timestamp` column → `timestamptz` (migration `0002_high_impossible_man`); the seed
  writes real instants (SGT wall-clock times carry a `+08:00` offset).
- ✅ `/dashboard` and `/bookings*` render client-side (`+page.ts` `ssr = false`); `format.ts`
  helpers take an explicit zone so times show in the **viewer's** zone (their stored
  `user.timezone` — added in Phase 3 — else the browser's).

## Phase 3 — Coach directory & booking request (client) ✅ done
**Estimate: ~10h** (highest-risk phase to underestimate)

*Design screens: "Bookings" → choose coach, coach profile / book panel*

- ✅ Coach list (`/bookings`, `+page.svelte`): search, **multi-select** tag filter chips
  (`all` clears; picking >1 tag matches any of them), sort (soonest / most open slots / price /
  name), **+ a `show` limit dropdown (5 / 10 / 25, default 10)** applied after filter+sort.
  Coaches carry multiple tags (`coach_profile.tags` array). Filter/sort/limit are client-side;
  the server load precomputes each coach's open-slot count and soonest-free for the two
  availability sorts.
- ✅ Coach profile panel (`/bookings/[slug]`): bio, rate, trains-at, open-hours chips, tags,
  shareable `builtwithhabit.com/book/<slug>` link + copy button.
- ✅ Booking form: session type / duration (45·60·90 → 0.75·1·1.5 credits) / date / live slot
  grid; submit → `booking` row, `pending_approval` when the client has the credits else
  `pending_payment`. Server action re-validates the slot (`?/request` in
  `[slug]/+page.server.ts`) — never trusts the posted time. *(Phase 5.5 replaces the duration
  picker with a package picker — length follows the chosen package.)*
- ✅ Date range: today **through the day the active package's credits expire** (`getActivePackage`;
  8 weeks out if no package). Picker is month chips → day chips (`datesInRange` in `tz.ts`);
  month row hides when the range is a single month. Form notes the expiry date; the action
  rejects a start after `packagePurchase.expiresAt`. Seed: Farah has a `build` package expiring
  ~12 sep to exercise the near-expiry case. *(Phase 5.5: the cap becomes the selected purchase's
  `expires_at`.)*
- ✅ Real availability (`src/lib/availability.ts` `daySlots` / `openness`): generates 30-min
  starts from `availability_slot` windows on the coach-local weekday, blocks starts that overlap
  a `pending_approval | pending_payment | confirmed` booking or are in the past.
- ✅ **Coach timezone.** `coach_profile.timezone` + `user.timezone` added (migration
  `0003_common_marvel_apes`, wired through better-auth `additionalFields`). Availability windows
  are wall-clock in the coach's zone; `src/lib/tz.ts` converts via `Intl` (DST-safe,
  isomorphic). If client and coach zones differ, only online session types are offered (form +
  server both enforce). Seed: ishita/nadia `Asia/Singapore`, jolene `Asia/Dubai` to exercise it.
- ✅ **Session-type gates** compose in `allowedTypes` (form) and the `?/request` action:
  cross-timezone → online types only; **PAR-Q not submitted → free consult only**
  (`PRE_SCREENING_TYPES`, `getIntakeComplete`); both → free consult. Phase 7 builds the PAR-Q
  form itself; this is the booking-side gate the roadmap's Phase 7 line refers to.
- ✅ **Read-only bookings list** with `upcoming / awaiting action / past` tabs landed here on
  `/bookings` (left column). Row actions (pay / reschedule / cancel / notes) + the 24h
  cancellation policy are still **Phase 5**.

## Phase 4 — Checkout & payments (client) 🚧 partial
**Estimate: ~6h** (PayNow + flag + object storage, done) **+ ~2h** (Stripe, still deferred)

*Design screen: checkout modal (review → pay → waiting/confirmed)*

- ✅ **`ENABLE_STRIPE_PAYMENTS` feature flag** (`apps/booking-portal/src/lib/server/payments.ts`,
  default `false`). `false` → the paynow flow below runs; `true` → the `pay` action
  short-circuits with a descriptive "not implemented yet" error instead of touching
  Stripe (`STRIPE_NOT_IMPLEMENTED` in `src/lib/payments.ts`, shared with the client so
  the checkout modal can render the same message) — Stripe itself is still deferred.
- ✅ Checkout modal shell (`src/lib/components/checkoutModal.svelte`): review → pay →
  **waiting** steps, triggered from a "pay" button on `pending_payment` rows in the
  bookings list.
- ✅ PayNow flow: review step shows a mock QR placeholder + amount (no real PayNow
  integration exists, so this is explicitly a stand-in); pay step uploads a screenshot
  to object storage (with a live preview) and inserts an `invoice` row (`status: "pending"`,
  `method: "paynow · awaiting verification"`); booking flips to the new
  **`pending_verification`** status ("waiting"). Amount = coach's `rateFromCents`
  treated as hourly, scaled to the booking's duration. *(Phase 5.5: checkout sells a whole
  **package**, not a single session — amount = package total, invoice links the intended
  package, `package_purchase` is created at Phase 9 verification.)*
- ⬜ **Real payment QR: Ishita's PayNow QR.** All client payments land in one account
  (Ishita's) rather than per-coach. Coaches then get paid out by Ishita when they
  request a payout (Phase 9's "my payouts"), net of a **per-booking/session platform
  commission** — so payout = Σ(session price − commission) for verified, completed
  sessions not yet paid out. The commission rate + payout ledger are Phase 10 admin
  settings; the QR image itself just replaces the placeholder in `checkoutModal.svelte`.
- ✅ **Object storage**: new `@repo/storage` package (thin S3 wrapper, works
  unchanged against dev and prod). Dev runs [floci](https://floci.io) in
  `docker-compose.yml` (S3-compatible, no docker.sock needed since only S3 — an
  in-process service — is used); prod points the same client at real S3.
- ⬜ **Verification → confirmed is NOT built here, by design.** `pending_verification`
  is a dead end until Phase 9 ships the trainer's real payments-to-verify queue —
  that's where invoice-paid + session-ledger + booking-confirmed actually happens
  (post-5.5: also `package_purchase` creation + first session consumed).
  No temporary admin/trainer UI was added for this on purpose, to avoid throwaway
  code once Phase 9 lands.
- ⬜ Stripe card flow — deferred; the flag above is the only Stripe-shaped code that
  exists today.

## Phase 5 — Bookings management (client) ✅ done
**Estimate: ~5.5h**

*Design screen: "Bookings" list, upcoming/past/all tabs*

State machine (all of Phases 3–5, plus the Phase 9 gaps): [`BOOKING-LIFECYCLE.md`](BOOKING-LIFECYCLE.md).

- ✅ List stays on `/bookings` (combined with the coach directory, not split). Every booking row
  now opens one **manage-session modal** (`ManageBookingModal.svelte`, refactored from the old
  `CheckoutModal`) that shows the actions valid for that booking's state and branches into the
  matching flow.
- ✅ Per-row actions:
  - **pay to confirm** — the Phase 4 PayNow review → upload → waiting steps, now a branch of the
    manage modal
  - **reschedule** — reuses the coach page's live slot grid via
    `/bookings/[slug]?reschedule=<id>` (same coach only). `?/reschedule` re-validates the slot
    (excluding the booking's own slot), re-applies the cross-zone / PAR-Q / package-expiry gates,
    then sets the booking back to `pending_approval` for the coach to re-confirm. A `confirmed`
    booking also gets a `refund_in_time` credit return so Phase 9's re-approval re-charges
    cleanly; rescheduling a `confirmed` booking is blocked inside the 24h window.
  - **cancel** — `?/cancel` → `cancelBooking()` in `src/lib/server/cancellation.ts`
  - **your notes** — client-authored post-session reflection (`booking.client_reflection`,
    migration `0005_naive_tyger_tiger`), `?/reflect` action, past / `completed` bookings only,
    shown inline on the row
- ✅ Cancellation policy (`cancelOutcome` / `canReschedule` in `src/lib/booking.ts`,
  `CANCELLATION_WINDOW_HOURS = 24` hardcoded until Phase 10):
  - `pending_approval` / `pending_payment` → plain cancel, no ledger movement (no credit was taken)
  - `pending_verification` → the in-flight PayNow invoice is voided to `no_charge`; the modal tells
    the client to contact the coach about the transfer
  - `confirmed`, ≥24h out → `refund_in_time` credit returned to the ledger
  - `confirmed`, <24h out → credit forfeited, recorded as a `no_charge` "late cancellation" invoice
    (mirrors the seed's `bwh-0118`)
  - **Phase 5.5 simplifies this** — no cash/credit refunds, just session-returned (≥24h) vs
    session-forfeited (<24h); the `<24h` no-charge invoice is dropped. See Phase 5.5.

## Phase 5.5 — Coach packages (replaces credits) ⬜
**Estimate: ~14.5h** (+ ~2.5h for the Phase 9 package editor)

Cross-cutting model change, like Phase 2.5 — inserted mid-stream because everything downstream
depends on it. The credit model assumed one platform-wide session price; that breaks the moment
a second coach prices differently. Replaced with **coach-authored packages**. Phases 6, 9 and 10
build on this shape. The prototype's "Packages & credits" screen (credit pips) is no longer
source-of-truth for this area.

**The model**

- A **package** belongs to a coach and specifies: number of sessions, length of each session
  (minutes), cost per session, validity window (days). Total price = count × per-session cost
  (computed, not stored). Coaches author their own — seeded until Phase 9 ships the editor.
- Buying a package creates a `package_purchase` granting N sessions of that length, expiring
  `purchased_at + validity_days`. Balance is tracked **per purchase** (append-only
  `session_ledger_entry`, whole-session deltas), drawn down FIFO by soonest expiry.
- `coach_profile.rate_from_cents` is **removed** — pricing lives entirely in packages. A coach
  who wants one-offs publishes a 1-session package. Directory / profile show "packages from
  SG$X / session" (cheapest package, subquery); the price sort keys on that.
- "Credits" is gone from schema and UI — everything is "sessions" tied to a named package
  with a coach.

**Booking**

- The 45/60/90 duration picker is replaced by a **package picker** — length follows the chosen
  package. Session *type* (in-person / online / consult / assessment) stays an independent
  booking-time choice, still gated by timezone / PAR-Q. Free consult is unchanged: free, no
  package, fixed 30 min.
- Active package with this coach + a session in hand (balance − pending holds ≥ 1) → request
  lands `pending_approval`; the session is consumed at Phase 9 approval, as credits were.
- No package with this coach → pick one of their packages → `pending_payment` booking carrying
  `intended_package_id` and the package's length. The Phase 4 checkout modal now sells the
  **whole package**: PayNow QR for the full price, upload proof, an `invoice` (pending, linked to
  the intended package) is written, booking → `pending_verification`. The `package_purchase` +
  session grant + first consume happen at Phase 9 verification — so it stays a clean dead end
  until then.

**Cancel / reschedule** (supersedes Phase 5's credit policy)

No cash refunds — a package is bought as a block. The only question is whether the session goes
back to the pack or is burned:

| Booking state | Notice | Result |
| :-- | :-- | :-- |
| `pending_approval` / `pending_payment` | — | plain cancel — no session consumed yet |
| `pending_verification` | — | void the pending package invoice (purchase never happened) |
| `confirmed` | ≥ 24h | session returned to the purchase (`+1` ledger entry) |
| `confirmed` | < 24h | session forfeited — the `−1` stands, nothing else |

Reschedule ≥ 24h: session returned, booking → `pending_approval`, re-approval re-consumes.
Reschedule < 24h: blocked. The `< 24h` cancel no longer writes a `no_charge` invoice.
`cancelOutcome`'s `refund` outcome is renamed `return`.

**Schema** — migration `0006`, no prod data:

- `package` + `coach_id`, `session_length_min`, `price_per_session_cents`, `validity_days`
  (was `credit_expiry_months`); `session_count` kept
- `package_purchase` — `credits_granted` → `sessions_granted`, + `session_length_min` snapshot,
  `expires_at` derived from `validity_days`
- `credit_ledger_entry` → `session_ledger_entry`; `purchase_id` NOT NULL; `delta` whole sessions;
  reasons `purchase` / `session_consumed` / `returned_in_time` / `adjustment`
- `booking` — drop `credit_cost`; add `package_purchase_id` (draws from) + `intended_package_id`
  (set while `pending_payment`)
- `coach_profile` — drop `rate_from_cents`

**Code** (~10 files): `src/lib/booking.ts` (drop `creditCostFor` / `sessionAmountCents` /
`DURATIONS`; `cancelOutcome` `refund`→`return`, drop the forfeit invoice); `queries.ts`
(per-purchase balance, active-purchase pick, dashboard list, coach cheapest-price);
`cancellation.ts`; `bookings/[slug]/+page.server.ts` + `.svelte` (package picker, buy branch);
`ManageBookingModal.svelte` (sell a package); `dashboard/+page.svelte`; `seed.ts`
(per-coach packages); `BOOKING-LIFECYCLE.md`.

| Line item | Estimate |
| :-- | :-- |
| Schema + migration + seed | ~2h |
| `queries.ts` rework | ~2h |
| Booking form — package picker, buy-a-package path | ~3h |
| Booking gate / reschedule / cancel against packages | ~2h |
| Checkout modal — sell a package | ~2h |
| Dashboard + modal + copy | ~2h |
| Docs (ROADMAP, BOOKING-LIFECYCLE) | ~1.5h |
| **Total** | **~14.5h** |

## Phase 6 — Packages & sessions, payments (client) ⬜
**Estimate: ~5.5h**

*Design screens: "Packages & credits" (re-scoped by Phase 5.5), "Payments"*

- "Your packages" — a card per active `package_purchase`: coach, package name, sessions
  remaining / N, length, expiry, + that purchase's `session_ledger_entry` activity log — *2h*
- "Buy a package" — browse a coach's packages and purchase via the Phase 4 checkout modal
  **standalone** (not tied to a booking; the 5.5 checkout only handles the booking-linked path) — *1h*
- Payments page: stats, invoice table, saved payment methods, cancellation-policy blurb — *2.5h*

## Phase 7 — Intake / PAR-Q health screening ⬜
**Estimate: ~4.5h**

*Design screen: "Intake PAR-Q"*

- Multi-step form (progress bar, PAR-Q questions) — *2.5h*
- 🚧 Gate booking on completion — **done in Phase 3**: without a submitted PAR-Q only a free
  consult can be booked (form + `?/request`). This phase just adds the form that flips
  `intake_response.submitted_at`. Still to do: scope visibility to client + assigned coach only
  (PDPA — don't surface to admin by default) — *1.5h*

## Phase 8 — Progress tracking (client) ⬜
**Estimate: ~7.5h**

*Design screen: "Progress"*

- Stat tiles, chart with metric tabs, backed by `progress_entry` — *2.5h*
- Measurements list, "log this week's numbers" entry form — *2h*
- Check-in photos — private storage (client + assigned coach only) — *3h*

## Phase 9 — Trainer (coach) portal ⬜
**Estimate: ~11.5h**

*Design screens: "Trainer dashboard", "Trainer clients"*

- Dashboard: today's schedule, pending requests (approve / suggest another time — approve flips
  booking to `confirmed` **and consumes a session from the client's purchase**), payments-to-verify
  queue (PayNow screenshots from Phase 4 — verify creates the `package_purchase`, grants sessions,
  consumes the first, confirms the booking) — *3.5h*
- Weekly availability grid: tap to toggle open/closed; booked cells derived from real bookings,
  not manually set — *3h*
- Clients table: roster with sessions remaining, next session, attendance %, flags — derived
  (package running low / no screening / etc.), not manually set — *2.5h*
- **Package editor** (from Phase 5.5): CRUD the packages clients buy from this coach — session
  count, length, per-session price, validity days; deactivate without deleting (past purchases
  keep their snapshot) — *2.5h*

## Phase 10 — Admin portal ⬜
**Estimate: ~8h** **+ ~2h** ("preview as", deferred)

*Design screens: "Admin overview", "Admin users"*

- Overview: revenue by coach, utilization, all-bookings table — *3h*
- Settings: cancellation-window (the hardcoded 24h rule becomes editable), platform
  **commission rate** + payout ledger (Phase 4's payout math). Package pricing/validity is
  **coach-owned** now (Phase 9 editor), not admin — *2h*
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
- Test coverage for booking / session-ledger / cancellation logic (real money and scheduling
  correctness at stake) — *4h*
- Production deploy pipeline — *2h*

---

## Progress

**Done:** Phases 0, 1, 2, 2.5, 3, 5. **Phase 4 partial:** a `pending_payment` booking can be paid
via the manage-session modal's PayNow flow, landing at `pending_verification` — the loop is live
up to *client submits payment proof*, one step short of *confirmed* (Phase 9's job, see Phase 4
above).

**Next on the critical path:** Phase 5.5 (coach packages — replaces credits). It's a model change
Phase 6 (packages page) and Phase 9 (verify/approve, package editor) both build on, so it goes
first. After that, Phase 9 (trainer portal) — it verifies a PayNow payment, flips a booking to
`confirmed`, and re-approves rescheduled bookings; until it lands both `pending_verification` and
post-reschedule re-approval are dead ends.

## Suggested near-term order

Phase 1 → 2 → 3 → 4 → 5 is the critical path: it turns the placeholder dashboard into a working
booking loop (browse coach → request → pay → see it in bookings) before touching packages,
progress, trainer tools, or admin. **Phase 5.5 (coach packages)** then rebases the billing model
before Phase 6/9 build on it. Phases 6–11 can proceed in roughly the listed order, or be
reprioritized based on which role (client vs. coach vs. admin) needs to go live first.

## Total estimated effort

| Scope | Estimate |
| :-- | :-- |
| Critical path (Phases 1–5) | ~33h |
| Phase 5.5 (coach packages — replaces credits) | ~14.5h |
| Full client + trainer + admin core (Phases 1–11, excluding deferred items) | ~87h |
| Deferred items (Stripe, real AI assistant, "preview as") | ~8-10h |
| Polish & hardening (Phase 12) | ~16h |
| **End-to-end** | **~112-122h**, i.e. roughly 3-3.5 weeks of focused solo AI-assisted work |

Treat these as planning inputs, not commitments — re-estimate each phase once Phase 1's schema is
locked in, since it's the foundation everything else measures against. (Phase 5.5 re-opens the
billing tables — treat the Phase 6/9/10 estimates as provisional until it lands.)
