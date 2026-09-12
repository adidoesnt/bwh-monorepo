# Data model

Drizzle ORM schema, Postgres. Source of truth is `src/schema/*.ts`; this
document is a guide to reading it, not a replacement for it.

## ERD

See [`erd.html`](erd.html) (open it in a browser) for the entity-relationship diagram.

## Auth (`schema/auth.ts`)

better-auth's own tables, with `role`, `status`, and `timezone` added as
extra fields on `user`.

- **`user`** — `id`, `name`, `email` (unique), `emailVerified`, `image`,
  `role` (`client | trainer | admin`, default `client`), `status`
  (`active | invited`, default `active`), `timezone` (IANA zone, nullable
  until the user sets it — used to render times and to gate cross-timezone
  in-person bookings).
- **`session`**, **`account`**, **`verification`** — standard better-auth
  session/credential/email-verification tables, each `references` `user.id`
  with `onDelete: cascade`.

`role` drives the route guards in `hooks.server.ts`. `status: invited` marks
an account an admin created that hasn't set a password yet.

## Coaching (`schema/coaching.ts`)

- **`coach_profile`** — a bookable coach. Deliberately separate from
  `user.role`: any user can hold a coach profile regardless of which portal
  their role admits them to (an admin can also coach). Fields: `userId`
  (unique, cascade), `slug` (unique, for the shareable booking page),
  `speciality`, `tagline`, `bio`, `tags[]`, `locations[]`, `timezone`
  (default `Asia/Singapore` — `availability_slot` minutes are wall-clock in
  this zone), `coachingSince`, `active`.
- **`availability_slot`** — a recurring weekly open window: `coachId`,
  `weekday` (0 = Sunday … 6 = Saturday), `startMin`/`endMin` (minutes from
  midnight). Concrete bookable slots are derived from these at read time,
  minus cells already covered by a `booking`.

## Booking (`schema/booking.ts`)

- **`booking`** — one training session, from request through
  completed/cancelled. Fields: `clientId`, `coachId`, `type`
  (`1:1 in-person | 1:1 online | free consult | assessment`), `location`,
  `startsAt`, `durationMin`, `packagePurchaseId` (nullable — null means a
  free consult, not drawn from any purchase), `status`, `clientNote`
  (client's note at request time), `sessionNotes` (coach's, post-session),
  `clientReflection` (client's, post-session), `cancelledAt`.
- **`BookingStatus`** — `pending_approval | pending_payment |
  pending_verification | confirmed | completed | cancelled`. In practice a
  booking only ever moves `pending_approval → confirmed → completed` (or
  `→ cancelled` at any point before `completed`); `pending_payment` and
  `pending_verification` are reserved for a future in-flow payment step and
  aren't written today — money currently settles on the package-purchase
  side before a booking is confirmed.

## Billing (`schema/billing.ts`)

The billing model is package-first: coaches sell prepaid session packages,
clients purchase them, and each session a client books draws one session
off a purchase's balance. A booking never carries a price directly.

- **`package`** (exported as `packageOffering`) — a coach-authored product:
  `coachId`, `name`, `description`, `sessionCount`, `sessionLengthMin`
  (minutes per session in this package), `pricePerSessionCents`,
  `validityDays` (default 90 — sessions expire this many days after
  purchase), `active`. Total price is `sessionCount × pricePerSessionCents`,
  computed rather than stored.
- **`package_purchase`** — a client's purchase of a package; the event that
  grants sessions. Snapshots `pricePaidCents`, `sessionsGranted`, and
  `sessionLengthMin` at purchase time so later edits to the `package` don't
  retroactively move an existing purchase. Has its own `expiresAt`.
- **`session_ledger_entry`** — append-only ledger of session movements
  against a purchase. `delta` is signed and whole (one booking = one
  session); `reason` is one of `purchase | session_consumed |
  returned_in_time | adjustment`. A client's bookable balance with a coach
  is the sum of `delta` across their non-expired purchases with that coach.
  `bookingId` links a `session_consumed`/`returned_in_time` entry back to
  the booking that caused it (nullable — a `purchase` entry has none).
- **`invoice`** — a billing record shown on the client's payments page, one
  per payment event. `number` is a unique display id (e.g. `bwh-0182`).
  `method` is a free-text label (e.g. `visa ···· 4242`, `package`).
  `status` is `pending | paid | no_charge`. `proofImageKey` holds the S3 key
  of an uploaded payment screenshot for the manual-verification payment
  method. `stripeCheckoutSessionId` (unique) is the Checkout Session created
  at purchase time — the webhook matches its `checkout.session.completed`
  event against it. `stripePaymentIntentId` is the underlying PaymentIntent,
  kept for refunds. `packageId`/`purchaseId`/`bookingId` are optional links
  to what the invoice is for.

### Session balance rule

A client's bookable session count with a given coach is the sum of
`session_ledger_entry.delta` across all of that client's non-expired
`package_purchase` rows with that coach. Purchases are drawn down FIFO by
`expiresAt` when a booking is made, so the soonest-to-expire sessions are
spent first.

## Health (`schema/health.ts`)

- **`intake_response`** — one PAR-Q health screening + goals/history +
  consent per client (`clientId` unique). `parqAnswers` is a
  question-index → boolean map; `parqFlag` is true if any answer is "yes"
  and gates the client on doctor's clearance before training. Visibility is
  scoped to the client and coaches they currently hold an active package
  with — computed at query time from `package_purchase`, not stored on this
  row — and not surfaced to admins by default (PDPA).
- **`progress_entry`** — a dated value for a tracked metric (`metric` key
  like `squat_1rm`, `sessions_per_week`), `recordedOn` + `value` + `unit`.
- **`measurement`** — a dated body measurement (`kind` like `weight`,
  `waist`, `resting_hr`), `takenOn` + `value` + `unit`.

## Messaging (`schema/messaging.ts`)

- **`chat_message`** — one message in a client's help/support thread.
  `sender` is `user | bot | coach`. `escalatedAt` is set when a message is
  escalated to the client's coach.

## Conventions

- All domain-table ids are `text`, generated with `createId()`
  (`crypto.randomUUID()`, `schema/id.ts`). Auth tables keep better-auth's own
  ids.
- Every table has `createdAt`; mutable tables also have `updatedAt` via
  `$onUpdate`.
- `schema/index.ts` re-exports every sub-schema and also exports a merged
  `schema` default object, which is what `drizzle()` is initialized with.
