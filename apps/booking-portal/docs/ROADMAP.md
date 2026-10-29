# Booking Portal — Roadmap

Source of truth for the target product: the Claude Design prototype [**"Booking Portal"**](`https://claude.ai/design/p/785a988f-9a45-490a-9793-bb450e098596`). That file is a static,
click-through mock covering all three roles (client / trainer / admin) with placeholder data —
nothing in it is wired to a database or auth. This doc breaks it down into buildable phases for
the real app in `apps/booking-portal`, ordered so each phase ships something usable before the
next one starts.

Status is based on reading the current code (`apps/booking-portal/src`, `packages/database/src`)
and git history, not assumptions — re-check before trusting a ✅ if much time has passed.

**Legend:** ✅ done · 🚧 partial · ⬜ not started

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
- ✅ `/dashboard` exists as a placeholder welcome page

## Phase 1 — Data model & roles ✅ done

The schema the rest of the roadmap fills in — see [`DATA-MODEL.md`](../../../packages/database/docs/DATA-MODEL.md)
in `@repo/database` for the full reference.

- ✅ `role` (`client` | `trainer` | `admin`, default `client`) + `status` (`active` | `invited`)
  on `user`, wired through better-auth `additionalFields` so they land in the session /
  `App.Locals`
- ✅ Domain tables in `packages/database/src/schema/`: `coaching.ts` (`coach_profile`,
  `availability_slot`), `booking.ts` (`booking`), `billing.ts` (`package`, `package_purchase`,
  `session_ledger_entry`, `invoice`), `health.ts` (`intake_response`, `progress_entry`,
  `measurement`), `messaging.ts` (`chat_message`). `coach_profile` is decoupled from `role` on
  purpose — a user can hold a coach profile regardless of which portal their `role` admits them to.
- ✅ Role-based route guards in `hooks.server.ts`: shared surfaces need any session;
  `/trainer/*` is trainer+admin, `/admin/*` is admin-only; wrong-role access → role's home.
  (`HOME_BY_ROLE` points every role at `/dashboard`, which renders a role-specific view — see
  Phase 8.)
- ✅ Seed script (`bun run db:seed`, `packages/database/src/seed.ts`) mirrors the prototype:
  Ishita/Nadia/Jolene coaches, Tessa as the worked-example client (an active package, bookings,
  progress, measurements, completed PAR-Q), plus Renee/Farah/Declan/Hana/Yasmin. Farah has a
  package expiring soon and **no** PAR-Q, to exercise Phase 3's date-cap and screening gates. All
  seed users log in with password `password`. Idempotent (upserts users, wipes+reinserts domain
  tables).

## Phase 2 — Client dashboard shell & navigation ✅ done

*Design screens: global sidebar, "Client dashboard"*

- ✅ Replace the placeholder `/dashboard` with the real app shell: role-aware sidebar nav
  (dashboard / bookings / packages / payments / progress / help), logout
- ✅ Dashboard content: "hey {name}", stat cards (next session, active packages, sessions done,
  this week), "what's next" (upcoming bookings preview, capped to the soonest 3 with a "+N more"
  link to `/bookings` when there are more — row actions land once Phase 3/5 ship the routes to
  deep-link to), package carousel with per-purchase balance, recent-activity feed from
  `session_ledger_entry`
  - ✅ The package carousel is `$lib/components/PackagesCarousel.svelte`, shared with `/packages`
    (see Phase 4) rather than duplicated. Each slide has a "request a session" button that
    deep-links to `/bookings/[slug]?package=<purchaseId>`, pre-selecting that purchase on the
    booking form. Prev/next slide navigation uses `scrollIntoView({ block: 'nearest' })` on click
    rather than the raw `href="#id"` fragment-jump daisyUI's carousel pattern suggests — the native
    fragment-jump scrolls the whole page, not just the carousel, which was a real regression caught
    and fixed this session.
- ✅ Render dates in the viewer's timezone: `/dashboard` renders client-side (`ssr = false`) so
  times show in the viewer's stored `user.timezone`, else the browser's

## Phase 3 — Coach directory & booking request (client) 🚧 partial

*Design screens: "Bookings" → choose coach, coach profile / book panel*

- ✅ Coach list (`/bookings`): search, multi-select tag filter chips (horizontally scrollable, an
  "all" chip clears them), sort, a `show` limit dropdown (5 / 10 / 25, default 10) — all
  **server-side**, driven by URL search params (`?q=&tags=&sort=&page=`) for shareable/bookmarkable
  views. Coaches carry multiple tags (`coach_profile.tags` array, matched via Postgres
  array-overlap). Sort is `name` / `price` (cheapest active package) via a custom daisyUI dropdown
  (not a native `<select>`, so the popup itself can be styled). Each card shows an avatar, tagline,
  tags, and price; the `soonest` / `most open slots` sorts and a real "next free" line are still
  ⬜ — they need availability computed in a way that's sortable/paginated at the DB level, a bigger
  lift than the rest of this bullet (see the availability bullet below). Tag chips currently list
  every distinct tag across active coaches (`getAllCoachTags`), alphabetically, uncapped — capping
  to the top N most-used once the vocabulary grows is a known follow-up, not yet done.
- ✅ Coach profile panel (`/bookings/[slug]`): "← all coaches" back link, header (name, tagline,
  tags), bio, rate ("from SG$X per session"), trains-at (locations), open-hours chips (the coach's
  *distinct* weekly windows, deduplicated — a quick-glance summary, not tied to whichever date is
  selected further down), shareable `builtwithhabit.com/book/<slug>` link + copy button.
  ⬜ **Not built:** opening it inline (modal/drawer via SvelteKit shallow routing, with a back
  button and an expand-to-full-page button) from the coach directory — see "opening the profile"
  note below. Right now it's only reachable as the full standalone page.
- ✅ Booking form ("book {coach}"): session type chips (`1:1 in-person` / `1:1 online` /
  `free consult` / `assessment`, gated — see below) → **package picker** (which active package with
  this coach to draw from, ordered soonest-expiring first/FIFO; length follows the package, no free
  duration choice; shows `bookable` = balance − holds, with an info icon + tooltip breakdown when
  holds > 0 — see "holds" below) → date picker (month header with prev/next navigation, day chips
  scoped to the viewed month — see the date range bullet) → time chips for
  the selected date + package length, unavailable starts shown struck-through rather than hidden →
  location (a picker if the coach trains in-person at more than one place) → client note textarea →
  summary bar → "send request". Package/date/time/type are **URL-driven**
  (`?type=&package=&date=&startsAt=`), same pattern as `/bookings`'s search/tags/sort/pagination —
  the `?/request` action re-parses `request.url` the same way `load` does rather than trusting
  hidden form fields for them; only `note`/`location` are genuine posted fields. The action
  re-checks every gate fresh at submit time (type allowed, package exists/`bookable ≥ 1`/not
  expired, slot still actually available) before inserting the `booking` row at `pending_approval`
  — no ledger write, per `BOOKING-LIFECYCLE.md` (the session is only spent on coach approval). The
  two checks that concurrent requests can race on (a session still bookable, the slot still free)
  are re-run inside the insert's transaction under a per-coach lock — see the error handling bullet
  in Phase 4.
  Verified end-to-end against real data: a real submission produced a real row with the right
  fields, no ledger entry; resubmitting the same now-taken slot correctly failed with 409.
- ✅ Date range: the range (today through the active purchase's `expires_at`, 8 weeks out if free
  consult/no package) is computed once (`enumerateDateRange`) and split per-month (`daysInMonth`)
  for the picker — a month header (`monthYearLabel`) with prev/next navigation (`adjacentMonth`,
  disabled via `hasDayInMonth` at either end of the range) and day chips scoped to the viewed
  month. Simplified vs. the original sketch: navigation is adjacent-month only (no jump-to-a-
  specific-month control). Verified against real data (Ishita's 97-day range split 18/31/30/18
  days across Sep–Dec) and a live `?date=` round-trip, not just typechecked.
- ✅ Real availability: `$lib/utils/availability.ts` (pure logic, DST-safe coach-local ↔ UTC
  conversion) + `getCoachSlots`/`getCoachSlotsForDate` (`queries.ts`) generate every 30-min
  candidate from `availability_slot` windows on the coach-local weekday, each tagged
  `available: boolean` (past/overlapping an existing `pending_approval | confirmed` booking →
  `false`) rather than silently dropped — that's what drives the struck-through unavailable time
  chips. Verified against real seed data (Jolene, `Asia/Dubai`, and a real overlapping booking for
  Ishita), not just typechecked. No travel-time/buffer concept between in-person locations — a
  coach declines or counter-offers at approval time if a technically-open slot doesn't actually
  work for them (see `BOOKING-LIFECYCLE.md`).
  ⬜ **Not built:** the coach directory's "next free" line and the cross-coach `soonest`/`most open
  slots` sort — the single-coach function this needed now exists, but neither consumer is wired up.
- ✅ Coach timezone + screening gates: `allowedSessionTypes` (`coach.ts`) intersects both —
  cross-timezone → only remote-compatible types (`1:1 online`, and `free consult`, treated as
  remote-compatible since it's a quick intro call not tied to the coach's location — that's what
  makes "both gates active" collapse to "free consult only" instead of an empty set, rather than an
  explicit rule); no submitted PAR-Q (`getClientIntakeSubmitted`) → `free consult` only. An unset
  `user.timezone` is treated as *not* cross-timezone (permissive default) since there's no
  onboarding flow yet that captures a client's zone. Disallowed chips render struck-through with a
  `title` explaining why, matching the time-chip treatment. The `?/request` action re-derives both
  gates fresh rather than trusting the page's `?type=`.
- ✅ Read-only bookings list with `upcoming / awaiting action / history` tabs on `/bookings`, each
  a server-side paginated bucket with its own count badge (see `BOOKING-LIFECYCLE.md`). History
  holds past sessions plus requests the coach declined, and requests that lapsed unanswered show
  as "lapsed". Row actions (reschedule / cancel) render as disabled placeholders; making them
  real, plus the 24h cancellation policy, is Phase 5.
- ✅ `CoachHeader`, `DropdownControl`, `Pager` pulled out to `$lib/components` once `/packages`
  needed the same coach-directory browsing UI `/bookings` already had (search/tags/sort/pagination,
  the coach header block) — no behavior change, just de-duplication. The booking form's `?/request`
  submit uses `use:enhance` (SvelteKit progressive enhancement — submits via `fetch` instead of a
  full page reload, so in-progress local state like the note textarea survives a failed submit).

**Opening the profile** (not built): clicking a coach in the directory should open this panel
inline (not full width) rather than a full navigation, so browsing several coaches doesn't reload
the page each time. A back button (top-left) returns to the directory; an expand button (top-right)
takes the client to the real `/bookings/[slug]` full-page version. Both views should be the same
component and `load` data — SvelteKit's shallow routing (`pushState`/`replaceState`) fits this
exactly: it opens route content in an overlay while still updating the URL, so there's no need to
build the profile UI twice, and the browser back button naturally closes the overlay.

**"Holds"** — a client's `bookable` sessions on a purchase (`balance − holds`, in
`getClientActivePackages`) subtracts their own other `pending_approval` bookings against that same
purchase, since the ledger only moves on coach approval, not on request. Without this, a client
could request several sessions off a purchase's balance before any got approved and over-commit
sessions that haven't actually been consumed. Verified against a real seeded pending booking
(Tessa/Nadia's "starter": `balance: 3, holds: 1, bookable: 2`), not synthetic data.

## Phase 4 — Package browsing, purchase & Stripe payments (client) 🚧 partial

*Design screen: checkout modal (review → pay → processing/confirmed)*

Money lives entirely on the package-purchase side — a booking never carries a price or a payment
state. See [`BOOKING-LIFECYCLE.md`](BOOKING-LIFECYCLE.md) for both state machines.

There are two purchase flows. **Today only the no-payment flow exists.**

- **No-payment flow** ✅ — `?/buy` → cap check → `purchasePackage` inserts the `package_purchase`
  and an immediate `+N` `purchase` ledger entry, so sessions land at once.
- **Stripe flow** ⬜ — the diagram below; not built.

Both `?/buy` actions (`/packages/[slug]`, `/bookings/[slug]`) are the single seam: they call the
shared cap guard, then `purchasePackage` (no-payment) or, later, start a Checkout Session.

**Open decision:** how the two coexist. Either an env-driven switch (no-payment stays a real mode
for deployments where coaches take payment off-platform), or Stripe replaces the no-payment flow
outright. No switch exists yet — an unused `ENABLE_STRIPE_PAYMENTS` placeholder was removed from
`config.ts`. Decide when the Stripe flow starts.

```
Stripe flow:  buy → Stripe Checkout → processing (webhook in flight) → purchased
                                                                     → failed (no charge, retry)
```

- ✅ `/packages`: "your packages" (shared `PackagesCarousel` component, see Phase 2) · recent
  activity feed · **suggested packages** (`getSuggestedPackages`: one package per distinct
  recently-active coach, cheapest-first, when the client has booking/purchase history; otherwise
  the platform's most-purchased active packages, with a timezone match as a tiebreaker — a brand-
  new client with no history gets the popularity branch, verified against real seed data for both
  branches) · **browse packages** (the same server-side searchable/tag-filterable/sortable/
  paginated coach directory `/bookings` uses, reused via `getCoachDirectoryPage` +
  `parseCoachDirectoryParams`, linking into `/packages/[slug]` instead of the booking flow)
- ✅ `/packages/[slug]`: lists a coach's active package offerings; each has a real `?/buy` action
  (`use:enhance`) that inserts the `package_purchase` row and an immediate `+N` `purchase` ledger
  entry — **no Stripe wiring yet**, so sessions land as soon as the purchase row does, same spirit
  as how the booking form writes real `pending_approval` rows without payment infra. Verified
  end-to-end: a real purchase produced the right `package_purchase` + ledger rows and balance; the
  action's gates (missing/foreign-coach/inactive `packageId`) correctly reject. `/packages` shows a
  one-shot "package purchased" toast via `?bought=1`, mirroring `/bookings`' `?booked=1` pattern
- ✅ Per-package "activity" (`session_ledger_entry` history scoped to that one purchase, via
  `getPurchaseLedgerEntries`) — an inline expand/collapse on each carousel slide, not a floating
  popover. daisyUI's `.dropdown` was tried first but depends on the CSS Anchor Positioning API
  (`position-area`) to float the panel, which didn't escape the carousel's layout reliably; rather
  than fight that (a manual `position: absolute` + click-outside overlay was also tried and is a
  viable fallback if a floating panel is wanted elsewhere later), it's a plain `$state` toggle that
  expands in normal flow. Worth remembering if Phase 8's trainer portal reaches for a `.dropdown`
  inside a similarly cramped layout
- ✅ **Buying a package inline from the booking form** (`/bookings/[slug]`) when the client has no
  active package with that coach (no-payment flow). The dead-end message is replaced by the coach's
  packages; click one to select it and a "buy this package" button appears in its card. `?/buy` is
  a second, independent form action on the page (not merged into `?/request`); it returns instead
  of redirecting, so the URL's type/date/startsAt and the note textarea are untouched, `load` reruns,
  and the normal package picker takes over with an inline "purchased" confirmation. `use:enhance`
  on both forms, and the button disables while a request is in flight so a double-click can't buy
  twice. Only `packageId` is trusted from the form, revalidated against the page's coach. Verified
  against real data (purchase + ledger rows, gates)
- ✅ **`MAX_ACTIVE_PACKAGES = 5`** (`config.ts`, hardcoded until Phase 9) enforced for the
  no-payment flow in one shared place: `getPurchaseBlockReason` (`lib/server/packages.ts`), backed by
  `getClientActivePackageCount`, enforced atomically by `buyPackage` for both `?/buy` actions (409 at
  the cap) and read by both pages' `load` so the buy buttons disable with the reason up front instead
  of after a failed click. Verified by filling a real client to the cap and confirming the next buy is
  rejected from both pages with nothing written, and under concurrent load (see the error handling
  bullet). **Stripe flow will add:** "held" also counts pending purchase-
  invoices, and the check runs when the Checkout Session is *created*, not in the webhook (money
  has already moved by then)
- ✅ **Error handling pass** (`chore/error-handling-pass`), covering purchases *and* session
  requests:
  - **Atomic purchase.** `purchasePackage`'s two inserts run in one transaction (a failure between
    them can no longer leave a purchase with no ledger entry). `buyPackage` (`lib/server/packages.ts`)
    also takes a per-client advisory lock and re-checks the cap inside that transaction. With 8
    concurrent buys against a cap of 5, the lock-free version accepted all 8 (10 active); with it,
    exactly 3 were accepted and the count landed on 5.
  - **Atomic session request.** `bookSession` (`lib/server/bookings.ts`) takes a per-coach advisory
    lock and re-checks `bookable ≥ 1` and that the slot is still free *inside the transaction* with
    the insert — one lock covers both, since a package belongs to one coach. The availability
    queries, `getClientActivePackages` and `createBooking` take an optional `DbExecutor` so they can
    join it without a second definition of "available". Lock-free, 12 concurrent requests for one
    slot created up to 5 bookings and a 6-session package accepted 8 of 9 requests; with the lock,
    exactly 1 booking per slot and exactly 6 accepted.
  - **Unexpected failures don't strand the client.** `actionFailure` (`lib/server/errors.ts`) wraps
    `?/buy` (both pages) and `?/request` so a DB failure returns `fail(500, …)` with a friendly
    message instead of SvelteKit's bare error page (rethrowing `redirect()`/`error()`, which work by
    throwing). Verified by forcing real failures with temporary triggers: the message came back and
    nothing was left behind.
  - **Error pages and reference ids.** Root and `(app)` `+error.svelte` share one `ErrorMessage`
    component (the `(app)` one keeps the sidebar). A `handleError` hook logs unexpected 5xx errors
    with method, path, user id and stack under a short id and shows it on the page; statuses below
    500 (unknown routes) pass through untouched.
  - **Auth forms.** Login/signup return a 500 form error (values kept) for non-`APIError` failures.
    Logout was left alone — better-auth swallows `signOut` failures itself and still clears the
    cookie, checked with a forced failure.
  - **Client-side.** `use:enhance` forms (`?/request`, both `?/buy`s) show an inline message on a
    dropped connection instead of swapping the page for the error page, and disable while in
    flight; the copy-link button handles a denied clipboard.
  - **Known gaps:** no `hooks.client.ts` `handleError`; the `fail(500)`s from `actionFailure` are
    logged but don't carry a reference id; signup's non-`APIError` branch is unexercised (better-auth
    wraps DB failures as `APIError`); and the error pages and network-failure messages were checked
    by reading code and probing endpoints, not in a browser.
- ⬜ **Stripe flow:** `?/buy` creates a Stripe Checkout Session for the package total instead of
  calling `purchasePackage` (metadata: client + package id), writes an `invoice` row
  (`status: pending`, `stripe_checkout_session_id`), and redirects to Stripe's hosted checkout
- ⬜ Webhook (`src/routes/webhooks/stripe/+server.ts`): verifies the Stripe signature, handles
  `checkout.session.completed` — creates the `package_purchase` the same way `purchasePackage`
  does today (snapshotting `sessionsGranted`, `sessionLengthMin`, `expiresAt`), writes the `+N`
  `purchase` ledger entry, flips the invoice to `paid`. A failed/expired session flips the invoice
  to a failed state instead
- **Under consideration, not decided:** disallowing more than *one* active package **per coach**
  at a time (separate from the global 5-package cap above). Nothing in the schema or Phase 3's
  booking form currently prevents a client holding two simultaneous active purchases with the same
  coach — both would just show as separate chips in the package picker, correctly ordered
  soonest-expiring first. If this gets restricted, it belongs here (`?/buy` is what would reject
  the second purchase), not in the booking form itself.
- `/payments` — invoice table (number, date, description, amount, status) + stats (total paid /
  count / processing) + cancellation-policy blurb. No saved payment methods
- `/activity` — full `session_ledger_entry` log, chronological, per-purchase running balance on
  each row, coach filter chips, 20/page client-side pagination

## Phase 5 — Bookings management (client) ✅ done

*Design screen: "Bookings" list, upcoming/past/all tabs*

State machine: [`BOOKING-LIFECYCLE.md`](BOOKING-LIFECYCLE.md).

- ✅ List stays on `/bookings` (combined with the coach directory, not split). Every booking row
  opens one manage-session modal showing the booking's details and the actions valid for its
  state. Which actions are valid (`cancelOutcome`, `canReschedule`, `canReflect`) is worked out
  server-side in `lib/server/bookings.ts` and returned on each row; the actions re-check it under
  the coach lock.
- Per-row actions:
  - **reschedule** — reuses the coach page's live slot grid via
    `/bookings/[slug]?reschedule=<id>` (same coach; the type, package and length stay fixed, and
    the type / package / location / note fields are hidden). Re-validates the slot (excluding the
    booking's own slot and its own hold on the package) and re-applies the cross-zone / PAR-Q /
    package-expiry gates. The current time shows as "· now" and can't be picked.
    - ✅ A `pending_approval` request just moves to the new time (`rescheduleBooking`), then lands
      on *awaiting action* with a "moved" toast. Verified: moving overlapping its own slot, on a
      package whose only session is its own hold; same time / taken / outside hours / confirmed /
      someone else's refused; 10 runs racing a move against the coach approving always ended
      confirmed with one `−1`, at either the old or the new time.
    - ✅ A `confirmed` booking keeps its time: the new one is a **proposal** (`booking_proposal`,
      migration `0004`) the other side accepts or declines, with an optional reason (the proposer
      sees a fallback when it's empty). Both times are held until then (a live proposal's time
      counts as busy in `getCoachActiveBookings`), so a decline leaves the original session as it
      was. One live proposal per booking (partial unique index) — proposing again replaces it;
      the proposer can withdraw. No ledger movement: the session stays spent throughout. Blocked
      inside the 24h window (`rescheduleMode` → `move` / `propose` / null). Built for either side
      proposing (`proposedBy`), so the coach's "suggest another time" (Phase 8) is mostly UI on
      top. The same migration added `booking.cancelled_by` / `cancel_reason` (a client cancel
      sets `cancelled_by = 'client'`) for Phase 8's coach cancel. Verified: proposing holds the
      time for everyone else but not on the client's own reschedule page; replacing, withdrawing,
      and cancelling with a live proposal all withdraw it; 5 runs of two concurrent proposals
      always left exactly one pending.
  - ✅ **cancel** — voids the booking; no cash refunds since a package is bought as a block.
    Clears any live proposal. The form posts the outcome the client was shown; if it no longer
    holds (window passed, coach just approved) the cancel is refused rather than surprising them.
    Verified: all three outcomes against the ledger, the stale-modal refusal, and 10 runs racing
    a cancel against the coach approving (never a cancel that loses a spent session).
  - ✅ **your notes** — client-authored post-session reflection (`booking.client_reflection`,
    ≤ 1000 chars, empty clears it) on sessions that happened (`completed`, or `confirmed` and
    started), shown inline on the row ("+ add your notes" when empty).
- Cancellation policy (`CANCELLATION_WINDOW_HOURS = 24`, hardcoded until Phase 9), measured from
  the booking's current time, not a proposed one:

  | Booking state | Notice | Result |
  | :-- | :-- | :-- |
  | `pending_approval` | — | plain cancel — no session was consumed yet |
  | `confirmed` | ≥ 24h | session returned to the purchase (`+1` ledger entry) |
  | `confirmed` | < 24h | session forfeited — the `−1` stands, nothing else |

- ✅ **Cancelled bookings show in history on both sides**, badged "cancelled" or "late cancel" —
  derived from the booking's net ledger delta (`−1` = forfeited), no extra column. The client's
  modal explains which; the coach's history has a *cancelled* filter chip.
- ✅ **Coach side of reschedules:** a confirmed booking with a live client proposal moves to the
  coach's *awaiting action* tab under a *reschedules* chip (out of *upcoming*; counted in the nav
  badge and the dashboard's "needs action"), with "move it" / "keep current time" (+ optional
  note, ≤ 300 chars) in the same confirm modal as approve / decline. `acceptProposal` re-checks
  the new time against the coach's hours and the package's expiry under the coach lock;
  both refuse if the proposal the coach saw has been replaced or withdrawn. The week grid (dashboard
  and availability page) shows the proposed time as requested. Verified: accept moved the booking
  with no ledger change; decline stored the note and left the time; a request replaced behind an
  open modal was refused; a time outside the coach's hours was refused; 5 runs racing accept
  against the client withdrawing always ended moved + accepted or unmoved + withdrawn.
- Build order: ✅ cancel (+ the manage modal) → ✅ your notes → ✅ cancelled in both histories →
  ✅ reschedule of pending requests → ✅ proposals for confirmed bookings (migration + coach side).
- ✅ A refused coach action (approve / decline / complete / move it / keep current time) shows the
  reason as an error toast and reloads the list, so the row reflects what's true now — e.g. the
  client's newer request — or disappears if it was already handled.
- ✅ The dashboard's "waiting on you" stat card (was "requests waiting") counts new requests and
  reschedules together — "N requests · M reschedules" when both are waiting — and "oldest N ago"
  goes by when each was asked.

## Phase 6 — Intake / PAR-Q health screening ⬜

*Design screen: "Intake PAR-Q"*

- Multi-step form (progress bar, PAR-Q questions), writes `intake_response` and flips
  `submitted_at`
- Booking-side gate (only a free consult bookable without a submitted PAR-Q) is Phase 3's
  concern; this phase scopes visibility to client + assigned coach only (PDPA — don't surface to
  admin by default)

## Phase 7 — Progress tracking (client) ⬜

*Design screen: "Progress"*

- Stat tiles, chart with metric tabs, backed by `progress_entry`
- Measurements list, "log this week's numbers" entry form
- Check-in photos — private storage (client + assigned coach only)

## Phase 8 — Trainer (coach) portal 🚧 partial

*Design screens: "Trainer dashboard", "Trainer clients"*

Shared surfaces render per role instead of living under `/trainer/*`: `/dashboard` and
`/bookings` each branch in `load` on role and return a tagged result (`{ view: 'client' | 'trainer'
| 'admin', … }`) that the page hands to a `ClientX.svelte` / `TrainerX.svelte` component.
`/trainer/*` stays for trainer-only pages (clients, payouts). A trainer is linked to their
`coach_profile` via `getCoachProfileByUserId`; one without a profile sees an empty state.

- ✅ **Dashboard** (`/dashboard`, trainer view): four stat cards — today (with first–last time),
  this week (with "N done so far"), waiting on you (requests + reschedules, with "oldest N ago"),
  active clients (with
  "N running low"; a placeholder for monthly revenue until the Stripe flow exists) — then
  **today** and **needs action** widgets. Needs action groups requests and sessions to close out,
  3 each with "+N more" / "view all" deep-linking into `/bookings` pre-filtered. "Today" and "this
  week" use the coach profile's timezone, not the browser's. `StatCard` is shared with the client
  dashboard.
- ✅ **Sessions page** (`/bookings`, trainer view; "sessions" in the trainer nav, which carries the
  needs-action badge): client-name search, `upcoming / awaiting action / history` tabs with
  counts, filter chips (*requests / to close out* on awaiting action; *completed / declined /
  lapsed* on history), server-side pagination. Everything is URL-driven (`?tab=&filter=&q=&page=`).
  Rows are `$lib/components/CoachSessionRow.svelte`, shared with the dashboard widget.
- ✅ **Approve / decline / mark complete** — `?/approve`, `?/decline`, `?/complete` on `/bookings`,
  posted to from both the page and the dashboard. Approve and decline run under the same per-coach
  advisory lock as `bookSession` and re-check the request is still pending and in the future;
  approve also re-checks the package hasn't expired and has a session left, then confirms and
  writes `session_consumed −1` in one transaction. Decline sets the new **`declined`** status
  (distinct from a client's `cancelled`), which shows in history on both sides. Complete is a
  conditional update (confirmed + already started) with no ledger change. Approve and decline
  confirm in a modal showing the full session and its effect on the package; success shows a
  toast and slides the row out. Verified against real data, including 3 concurrent approvals
  against a 2-session package (exactly 2 succeed).
- ✅ **Week grid** (`$lib/components/WeekGrid.svelte`, logic in `$lib/utils/weekGrid.ts`) on the
  dashboard and the availability page: this week, Mon–Sun in the coach's zone, 30-minute rows
  (rows closed every day skipped), each cell open / booked / requested / time off / closed — each
  day's hours being the weekly pattern adjusted by that date's one-off changes, "time off" (hatched,
  `off-stripes` in `app.css`, labelled "off" with the note on hover) only where the coach would
  otherwise be open — past cells dimmed, the client as "Tessa L." on every slot a session covers, "N hours still open
  this week". Below `xl` it scrolls both ways inside a capped height with the day row and hour
  column pinned (the `pinned-hour` utility in `app.css`).
- ✅ **Fix found on the way:** a request whose start passed unanswered kept holding a session on
  its package forever (`getClientActivePackages` counted every `pending_approval` booking as a
  hold), blocking the client from booking again. Holds now only count future requests.
- ✅ **Availability page** (`/trainer/availability`, "availability" in the trainer nav): read mode
  shows the week grid and the upcoming one-off changes (first 5, then "show N more"); "edit hours"
  (or `?edit=1` — the dashboard card's "edit hours" link) opens the editor; cancel or save returns
  to read mode. Open to anyone with a coach profile, including an admin who coaches (who has no nav
  link to it until Phase 9). A dashboard "quick edit" was built and then removed — it duplicated the
  page and made every dashboard load fetch editor-only data.
- ✅ **Hours editor** — `$lib/components/AvailabilityRangeEditor.svelte`, logic in
  `$lib/utils/availabilityEditor.ts`, server side in `lib/server/availability.ts`:
  - **Weekly hours** (`availability_slot`): one block per day — an open/closed toggle (closing
    remembers the hours for reopening), start/end dropdowns in 30-minute steps (ends up to
    "midnight"), "+ add hours", ✕, and "copy to…" other days (with "all weekdays"). A first
    version had coaches click/drag half-hour cells in a 48-row grid; a trainer couldn't work out
    how it worked, so it was replaced with these ranges.
  - **One-off changes** (`availability_exception`): time off or extra hours over a date range,
    all day or between two times, with an optional note. Listed under a divider below the weekly
    hours, edited in the same draft and saved in the same batch. An entry that would change
    nothing on any of its dates (extra hours that are already open, time off over hours that are
    already closed) can't be added, and an existing one that stops changing anything after a
    weekly edit is flagged to remove — the server refuses both.
  - **Inline feedback:** overlapping / reversed ranges; a "too short" note on a weekly range no
    package session fits in (only a free consult fits; skipped with no packages); and the
    upcoming sessions that would end up outside open hours — judged on each session's actual date
    (weekly hours + one-off changes before vs after), shown under the day or under one-off changes.
  - **Live preview:** the week grid with the draft applied. Side by side on `xl` (the preview
    sets the height, the day list scrolls), stacked below.
  - **Saving** (`?/saveHours` on `/trainer/availability`, `saveCoachHours`): zod-validated (real
    calendar dates, half-hour times, entries ending today or later, notes ≤ 100 chars), then the
    weekly windows and all *upcoming* one-off changes replaced in one transaction under the same
    per-coach lock as requests and approvals. Ended entries are kept; a save without the one-offs
    field leaves them alone. Bookings are never touched — if sessions would end up outside open
    hours, a "save your new hours?" modal lists them and asks for "save anyway". A toast on
    success; leaving with unsaved changes asks first.
  - **Slot generation** (`getCoachSlots`) applies each date's one-off changes (extra hours added,
    then time off removed — time off wins), so the client's booking form and `bookSession` both
    honour them.
  - Verified against real data: clients see weekly and one-off changes straight away (split
    windows, all-day and multi-day time off, extra hours on a closed day); invalid input and
    redundant entries are refused with nothing written; existing bookings in newly closed time
    stay; and 10 runs each racing a client request against closing that hour — weekly or as time
    off — always ended consistently (booked first and kept, or cleanly refused) with no errors.
- ⬜ **Suggest another time** — on a pending request (a counter-offer) or a confirmed session (the
  coach needs to move it). A `booking_proposal` with `proposedBy = coach`, reusing Phase 5's
  proposals: the client accepts or declines, and a confirmed session keeps its time until they do.
- ⬜ **Coach cancel** — for a session the coach can't make at all. Always returns the session
  (`+1 returned_in_time`) whatever the notice — a coach's cancellation never costs the client.
  Sets `booking.cancelled_by = 'coach'` (added in Phase 5's migration) and an optional
  `cancel_reason` shown to the client; history reads "cancelled by {coach}". Same lock and
  re-read as the client's cancel. Until Phase 12 exists the client only finds out next time they
  open the app, so the UI should prompt the coach to message them too.
- ⬜ **Clients table:** roster with sessions remaining, next session, attendance %, flags — derived
  (package running low / no screening / etc.), not manually set.
- ⬜ **Package editor:** CRUD the packages clients buy from this coach — session count, length,
  per-session price, validity days; deactivate without deleting (past purchases keep their
  snapshot).
- Known gaps: admins with a coach profile (Ishita) get the admin view, so can't reach their coach
  view until Phase 9's "coach view"; trainers can still open the client-only `/bookings/[slug]` and
  `/packages` pages; the test bookings used to verify this slice were inserted by hand because the
  seed's bookings are all dated September (make seed dates relative to when it runs).

## Phase 9 — Admin portal ⬜

*Design screens: "Admin overview", "Admin users"*

- Overview: revenue by coach, utilization, all-bookings table
- Settings: make the hardcoded policy limits editable — `CANCELLATION_WINDOW_HOURS` (24) and
  `MAX_ACTIVE_PACKAGES` (5) — plus the platform commission rate + payout ledger. Package
  pricing/validity is coach-owned (Phase 8 editor), not admin
- Users: role management (client/trainer/admin), invite flow, audit log of role changes
- "Preview as" mode (admin viewing the app as a client/trainer) — *defer until the client and
  trainer surfaces are stable, since it just re-renders them with a banner*

## Phase 10 — Help / support ⬜

*Design screen: "Help and support"*

- Chat UI backed by `chat_message`, canned/FAQ-suggestion responses
- Escalate-to-coach and WhatsApp link (static, just needs the coach's real contact info)
- Real AI assistant grounded on FAQs + account data — *highest-effort/lowest-priority piece
  of the mock, defer*

## Phase 11 — Polish & hardening ⬜
Spread across the project rather than a single sprint.

- In-app toasts: a shared toast exists (`$lib/toast.svelte.ts` → `showToast(message, variant)`,
  `success` or `error`, rendered once in the `(app)` layout; top-right from `md`, full width
  below). The bookings page's `?booked=1` / `?moved=1` flags now go through it; the "package
  purchased" toast still uses its own `?bought=1` pattern — move it onto the shared one. (Telling
  people about things that happened while they weren't looking is Phase 12.)
- Accessibility and responsive pass against the prototype's breakpoints
- Test coverage for booking / session-ledger / cancellation logic and the Stripe webhook (real
  money and scheduling correctness at stake). The concurrency checks that proved the purchase
  cap and double-booking fixes (Phase 4) were throwaway scripts, not committed tests; they're the
  first candidates to turn into real ones, since the failure they guard against is silent.
- Production deploy pipeline: pick a concrete SvelteKit adapter (adapter-auto can't detect one),
  and set the prod env — `BETTER_AUTH_SECRET` is **required** (dev + `vite build` fall back to a
  throwaway value; real prod runtime throws without it — see `src/lib/server/config.ts`), plus
  `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` from Phase 4

## Phase 12 — Notifications ⬜

Numbered last to avoid renumbering the phases code comments refer to, but needed earlier — see
"Suggested near-term order". Today nobody is told anything: a client learns a request was
approved, declined or moved, or that their coach cancelled, only by opening the app.

- **Events** (each to the other side of the booking):
  - to the coach — new request, request moved, reschedule proposed / withdrawn, client cancelled
    (flagging late cancels)
  - to the client — request approved / declined, proposal accepted / declined (with the reason),
    coach proposed a new time, coach cancelled (with the reason), package purchased
  - reminders — session tomorrow (both sides); requests still unanswered close to their start
    (coach); package running low or expiring soon (client)
- **Channels:** email first (pick a transactional provider). An in-app inbox / bell with an
  unread count is a cheap second, since it needs no provider. SMS / WhatsApp later, if at all.
- **Delivery:** write a `notification` row in the same transaction as the change that caused it
  (an outbox), and send from it afterwards — so a failed send never rolls back a booking, and a
  rolled-back booking never sends. Retries and "sent" state live on the row; the same rows back
  the in-app inbox.
- **Preferences:** per-user opt-outs per event type on the account page; reminders and
  coach-initiated changes on by default.
- **Copy:** templates in the brand voice, with times in the recipient's own timezone (clients and
  coaches can be in different zones).

---

## Progress

**Done:** Phases 0, 1, 2. **Phase 3 mostly done:** the coach directory, the bookings list, the
coach profile panel, real availability, the timezone/screening gates, and the booking form + its
`?/request` action are all built and verified end-to-end against real data. **Phase 4 mostly done
except the Stripe flow:** browsing packages (suggested + full coach directory), buying one from
`/packages/[slug]` or inline from the booking form, the 5-package cap, and the per-package activity
log are all real and verified against real data — for the **no-payment flow**. **Phase 8 partly
done:** the booking loop now works end to end — a client requests, the coach approves (spending a
session) or declines, and marks it complete afterwards — through the trainer dashboard and sessions
page, with a read-only availability grid. **Phase 5 done:** clients cancel (with the 24h policy
on the ledger), write notes on past sessions, see cancellations in history (as do coaches), move
pending requests to a new time, and ask to move confirmed sessions — which the coach accepts or
declines with a note, the original time held until they do.

**What's left in Phase 3:** opening the coach profile inline (shallow routing) instead of only as
a full page; the coach directory's "next free" line and `soonest`/`most open slots` sort (the
single-coach availability function they'd need already exists, just not wired to them).

**What's left in Phase 4:** the Stripe flow (Checkout + webhook + invoices) and deciding how it
coexists with the no-payment flow; and `/payments` and `/activity`. The error-handling pass
(atomic purchase/booking, `fail(500)`s, error pages, reference ids) is done — see its bullet for the
few known gaps.

**What's left in Phase 8:** suggest another time, coach cancel, the clients table, and the
package editor.
Availability is done: coaches set their weekly hours and one-off changes on `/trainer/availability`.

## Suggested near-term order

Phases 2 → 5 build the client booking loop (dashboard, timezones, coach directory + request,
Stripe checkout, bookings management). Phase 8 (trainer portal) is the first hard unblock after
that — until it lands, `pending_approval` bookings sit idle with no one to approve them. Phases
6, 7, 9, 10 otherwise proceed in roughly the listed order.

**Immediate next:** Phase 8's coach cancel and suggest another time, which reuse Phase 5's
proposals and `cancelled_by`. **Phase 12 (notifications) should follow soon after** —
once coaches can cancel or move sessions, a client who isn't told is worse off than before; at
minimum the coach-initiated events and the session-tomorrow reminder. The rest of Phase 8 (clients
table, package editor) can go either side of it.
