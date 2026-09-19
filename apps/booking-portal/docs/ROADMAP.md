# Booking Portal — Roadmap

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
and the checkout skeleton get established early and reused. The riskiest line item to underestimate
is real availability/slot computation in Phase 3 — everything downstream depends on it being
correct, and it's the one piece with actual scheduling-logic complexity rather than
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
- ✅ `/dashboard` exists as a placeholder welcome page

## Phase 1 — Data model & roles ✅ done
**Estimate: ~6h**

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
  (`HOME_BY_ROLE` all point at `/dashboard` until the trainer/admin route trees exist.)
- ✅ Seed script (`bun run db:seed`, `packages/database/src/seed.ts`) mirrors the prototype:
  Ishita/Nadia/Jolene coaches, Tessa as the worked-example client (an active package, bookings,
  progress, measurements, completed PAR-Q), plus Renee/Farah/Declan/Hana/Yasmin. Farah has a
  package expiring soon and **no** PAR-Q, to exercise Phase 3's date-cap and screening gates. All
  seed users log in with password `password`. Idempotent (upserts users, wipes+reinserts domain
  tables).

## Phase 2 — Client dashboard shell & navigation ✅ done
**Estimate: ~6h**

*Design screens: global sidebar, "Client dashboard"*

- ✅ Replace the placeholder `/dashboard` with the real app shell: role-aware sidebar nav
  (dashboard / bookings / packages / payments / progress / help), logout — *2h*
- ✅ Dashboard content: "hey {name}", stat cards (next session, active packages, sessions done,
  this week), "what's next" (upcoming bookings preview, capped to the soonest 3 with a "+N more"
  link to `/bookings` when there are more — row actions land once Phase 3/5 ship the routes to
  deep-link to), package carousel with per-purchase balance, recent-activity feed from
  `session_ledger_entry` — *3h*
  - ✅ The package carousel is `$lib/components/PackagesCarousel.svelte`, shared with `/packages`
    (see Phase 4) rather than duplicated. Each slide has a "request a session" button that
    deep-links to `/bookings/[slug]?package=<purchaseId>`, pre-selecting that purchase on the
    booking form. Prev/next slide navigation uses `scrollIntoView({ block: 'nearest' })` on click
    rather than the raw `href="#id"` fragment-jump daisyUI's carousel pattern suggests — the native
    fragment-jump scrolls the whole page, not just the carousel, which was a real regression caught
    and fixed this session.
- ✅ Render dates in the viewer's timezone: `/dashboard` renders client-side (`ssr = false`) so
  times show in the viewer's stored `user.timezone`, else the browser's — *1h*

## Phase 3 — Coach directory & booking request (client) 🚧 partial
**Estimate: ~10h** (highest-risk phase to underestimate)

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
  — no ledger write, per `BOOKING-LIFECYCLE.md` (the session is only spent on coach approval).
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
- ✅ Read-only bookings list with `upcoming / awaiting action / past` tabs on `/bookings`, each a
  server-side paginated bucket (date-first, status-second — see `BOOKING-LIFECYCLE.md`) with its
  own count badge. Row actions (reschedule / cancel) render as disabled placeholders; making them
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
**Estimate: ~9.5h** (~5h remaining — Stripe flow + `/payments` + `/activity`)

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
  `parseCoachDirectoryParams`, linking into `/packages/[slug]` instead of the booking flow) — *2h*
- ✅ `/packages/[slug]`: lists a coach's active package offerings; each has a real `?/buy` action
  (`use:enhance`) that inserts the `package_purchase` row and an immediate `+N` `purchase` ledger
  entry — **no Stripe wiring yet**, so sessions land as soon as the purchase row does, same spirit
  as how the booking form writes real `pending_approval` rows without payment infra. Verified
  end-to-end: a real purchase produced the right `package_purchase` + ledger rows and balance; the
  action's gates (missing/foreign-coach/inactive `packageId`) correctly reject. `/packages` shows a
  one-shot "package purchased" toast via `?bought=1`, mirroring `/bookings`' `?booked=1` pattern —
  *2h*
- ✅ Per-package "activity" (`session_ledger_entry` history scoped to that one purchase, via
  `getPurchaseLedgerEntries`) — an inline expand/collapse on each carousel slide, not a floating
  popover. daisyUI's `.dropdown` was tried first but depends on the CSS Anchor Positioning API
  (`position-area`) to float the panel, which didn't escape the carousel's layout reliably; rather
  than fight that (a manual `position: absolute` + click-outside overlay was also tried and is a
  viable fallback if a floating panel is wanted elsewhere later), it's a plain `$state` toggle that
  expands in normal flow. Worth remembering if Phase 8's trainer portal reaches for a `.dropdown`
  inside a similarly cramped layout — *0.5h*
- ✅ **Buying a package inline from the booking form** (`/bookings/[slug]`) when the client has no
  active package with that coach (no-payment flow). The dead-end message is replaced by the coach's
  packages; click one to select it and a "buy this package" button appears in its card. `?/buy` is
  a second, independent form action on the page (not merged into `?/request`); it returns instead
  of redirecting, so the URL's type/date/startsAt and the note textarea are untouched, `load` reruns,
  and the normal package picker takes over with an inline "purchased" confirmation. `use:enhance`
  on both forms, and the button disables while a request is in flight so a double-click can't buy
  twice. Only `packageId` is trusted from the form, revalidated against the page's coach. Verified
  against real data (purchase + ledger rows, gates) — *2h*
- ✅ **`MAX_ACTIVE_PACKAGES = 5`** (`config.ts`, hardcoded until Phase 9) enforced for the
  no-payment flow in one shared place: `getPurchaseBlockReason` (`lib/server/packages.ts`), backed by
  `getClientActivePackageCount`, called by both `?/buy` actions (409 at the cap) and by both pages'
  `load` so the buy buttons disable with the reason up front instead of after a failed click.
  Verified by filling a real client to the cap and confirming the next buy is rejected from both
  pages with nothing written. **Stripe flow will add:** "held" also counts pending purchase-
  invoices, and the check runs when the Checkout Session is *created*, not in the webhook (money
  has already moved by then) — *0.5h*
- ⬜ **Error handling pass** (planned on its own branch): `purchasePackage`'s two inserts and the cap
  check aren't in one transaction (see the `TODO` in `lib/server/packages.ts`) — a failure between
  the inserts leaves a purchase with no ledger entry, and simultaneous requests can both pass the
  cap check. There's also no `+error.svelte`, and an unexpected throw in `?/buy` lands on SvelteKit's
  bare error page and drops the client's in-progress booking selection; the actions should catch and
  return a `fail(500, …)` instead.
- ⬜ **Stripe flow:** `?/buy` creates a Stripe Checkout Session for the package total instead of
  calling `purchasePackage` (metadata: client + package id), writes an `invoice` row
  (`status: pending`, `stripe_checkout_session_id`), and redirects to Stripe's hosted checkout —
  *2h*
- ⬜ Webhook (`src/routes/webhooks/stripe/+server.ts`): verifies the Stripe signature, handles
  `checkout.session.completed` — creates the `package_purchase` the same way `purchasePackage`
  does today (snapshotting `sessionsGranted`, `sessionLengthMin`, `expiresAt`), writes the `+N`
  `purchase` ledger entry, flips the invoice to `paid`. A failed/expired session flips the invoice
  to a failed state instead — *2.5h*
- **Under consideration, not decided:** disallowing more than *one* active package **per coach**
  at a time (separate from the global 5-package cap above). Nothing in the schema or Phase 3's
  booking form currently prevents a client holding two simultaneous active purchases with the same
  coach — both would just show as separate chips in the package picker, correctly ordered
  soonest-expiring first. If this gets restricted, it belongs here (`?/buy` is what would reject
  the second purchase), not in the booking form itself.
- `/payments` — invoice table (number, date, description, amount, status) + stats (total paid /
  count / processing) + cancellation-policy blurb. No saved payment methods — *0.5h*
- `/activity` — full `session_ledger_entry` log, chronological, per-purchase running balance on
  each row, coach filter chips, 20/page client-side pagination — *0.5h*

## Phase 5 — Bookings management (client) ⬜
**Estimate: ~5.5h**

*Design screen: "Bookings" list, upcoming/past/all tabs*

State machine: [`BOOKING-LIFECYCLE.md`](BOOKING-LIFECYCLE.md).

- List stays on `/bookings` (combined with the coach directory, not split). Every booking row
  opens one manage-session modal showing the actions valid for that booking's state.
- Per-row actions:
  - **reschedule** — reuses the coach page's live slot grid via
    `/bookings/[slug]?reschedule=<id>` (same coach only). Re-validates the slot (excluding the
    booking's own slot), re-applies the cross-zone / PAR-Q / package-expiry gates, then sets the
    booking back to `pending_approval` for the coach to re-confirm. A `confirmed` booking also
    gets a `returned_in_time` session credit so re-approval re-consumes cleanly; rescheduling a
    `confirmed` booking is blocked inside the 24h window.
  - **cancel** — voids the booking; no cash refunds since a package is bought as a block.
  - **your notes** — client-authored post-session reflection (`booking.client_reflection`),
    past / `completed` bookings only, shown inline on the row.
- Cancellation policy (`CANCELLATION_WINDOW_HOURS = 24`, hardcoded until Phase 9):

  | Booking state | Notice | Result |
  | :-- | :-- | :-- |
  | `pending_approval` | — | plain cancel — no session was consumed yet |
  | `confirmed` | ≥ 24h | session returned to the purchase (`+1` ledger entry) |
  | `confirmed` | < 24h | session forfeited — the `−1` stands, nothing else |

## Phase 6 — Intake / PAR-Q health screening ⬜
**Estimate: ~4.5h**

*Design screen: "Intake PAR-Q"*

- Multi-step form (progress bar, PAR-Q questions), writes `intake_response` and flips
  `submitted_at` — *2.5h*
- Booking-side gate (only a free consult bookable without a submitted PAR-Q) is Phase 3's
  concern; this phase scopes visibility to client + assigned coach only (PDPA — don't surface to
  admin by default) — *1.5h*

## Phase 7 — Progress tracking (client) ⬜
**Estimate: ~7.5h**

*Design screen: "Progress"*

- Stat tiles, chart with metric tabs, backed by `progress_entry` — *2.5h*
- Measurements list, "log this week's numbers" entry form — *2h*
- Check-in photos — private storage (client + assigned coach only) — *3h*

## Phase 8 — Trainer (coach) portal ⬜
**Estimate: ~10h**

*Design screens: "Trainer dashboard", "Trainer clients"*

- Dashboard: today's schedule, pending requests (approve / suggest another time — approve flips
  booking to `confirmed` and consumes a session `−1` from the client's purchase) — *2h*
- Weekly availability grid: tap to toggle open/closed; booked cells derived from real bookings,
  not manually set — *3h*
- Clients table: roster with sessions remaining, next session, attendance %, flags — derived
  (package running low / no screening / etc.), not manually set — *2.5h*
- Package editor: CRUD the packages clients buy from this coach — session count, length,
  per-session price, validity days; deactivate without deleting (past purchases keep their
  snapshot) — *2.5h*

## Phase 9 — Admin portal ⬜
**Estimate: ~8h** **+ ~2h** ("preview as", deferred)

*Design screens: "Admin overview", "Admin users"*

- Overview: revenue by coach, utilization, all-bookings table — *3h*
- Settings: make the hardcoded policy limits editable — `CANCELLATION_WINDOW_HOURS` (24) and
  `MAX_ACTIVE_PACKAGES` (5) — plus the platform commission rate + payout ledger. Package
  pricing/validity is coach-owned (Phase 8 editor), not admin — *2h*
- Users: role management (client/trainer/admin), invite flow, audit log of role changes — *3h*
- "Preview as" mode (admin viewing the app as a client/trainer) — *2h, defer until the client and
  trainer surfaces are stable, since it just re-renders them with a banner*

## Phase 10 — Help / support ⬜
**Estimate: ~3h** (canned) **+ ~4-6h** (real AI assistant, deferred)

*Design screen: "Help and support"*

- Chat UI backed by `chat_message`, canned/FAQ-suggestion responses — *2.5h*
- Escalate-to-coach and WhatsApp link (static, just needs the coach's real contact info) — *0.5h*
- Real AI assistant grounded on FAQs + account data — *4-6h, highest-effort/lowest-priority piece
  of the mock, defer*

## Phase 11 — Polish & hardening ⬜
**Estimate: ~14h**, spread across the project rather than a single sprint

- Email/SMS reminders for upcoming sessions and pending approvals — *3h*
- Notifications/toasts wired to real events (payment received, etc.) — the pattern's first
  instance already exists (a "request sent" toast after `/bookings/[slug]`'s `?/request` redirect,
  via a `?booked=1` flag stripped from the URL after showing) — *1.5h remaining*
- Accessibility and responsive pass against the prototype's breakpoints — *3h*
- Test coverage for booking / session-ledger / cancellation logic and the Stripe webhook (real
  money and scheduling correctness at stake) — *4h*
- Production deploy pipeline: pick a concrete SvelteKit adapter (adapter-auto can't detect one),
  and set the prod env — `BETTER_AUTH_SECRET` is **required** (dev + `vite build` fall back to a
  throwaway value; real prod runtime throws without it — see `src/lib/server/config.ts`), plus
  `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` from Phase 4 — *2h*

---

## Progress

**Done:** Phases 0, 1, 2. **Phase 3 mostly done:** the coach directory, the bookings list, the
coach profile panel, real availability, the timezone/screening gates, and the booking form + its
`?/request` action are all built and verified end-to-end against real data. **Phase 4 mostly done
except the Stripe flow:** browsing packages (suggested + full coach directory), buying one from
`/packages/[slug]` or inline from the booking form, the 5-package cap, and the per-package activity
log are all real and verified against real data — for the **no-payment flow**. The Stripe flow
(Checkout, webhook, invoices) plus `/payments` and `/activity` are unbuilt.

**What's left in Phase 3:** opening the coach profile inline (shallow routing) instead of only as
a full page; the coach directory's "next free" line and `soonest`/`most open slots` sort (the
single-coach availability function they'd need already exists, just not wired to them).

**What's left in Phase 4:** the Stripe flow (Checkout + webhook + invoices) and deciding how it
coexists with the no-payment flow; `/payments` and `/activity`; and the purchase error-handling
pass (transaction around the purchase + cap race, `fail(500)` instead of the bare error page).

**Next on the critical path:** Phase 8 (trainer portal) is the real unblock now — every
`pending_approval` booking the form can now create sits idle with no one to approve it until a
coach can act on requests.

## Suggested near-term order

Phases 2 → 5 build the client booking loop (dashboard, timezones, coach directory + request,
Stripe checkout, bookings management). Phase 8 (trainer portal) is the first hard unblock after
that — until it lands, `pending_approval` bookings sit idle with no one to approve them. Phases
6, 7, 9, 10 otherwise proceed in roughly the listed order.

**Immediate next:** the client-side purchase loop is complete for the no-payment flow, so the choice
is Phase 8 (trainer portal — completes the booking loop end to end) or the Stripe flow (needs test
keys, a webhook secret and the Stripe CLI first). The error-handling pass is planned separately on
its own branch.

## Total estimated effort

| Scope | Estimate |
| :-- | :-- |
| Critical path (Phases 1–5) | ~38.5h |
| Full client + trainer + admin core (Phases 1–10, excluding deferred items) | ~90h |
| Deferred items (real AI assistant, "preview as") | ~6-8h |
| Polish & hardening (Phase 11) | ~14h |
| **End-to-end** | **~110-112h**, i.e. roughly 3 weeks of focused solo AI-assisted work |

Treat these as planning inputs, not commitments.
