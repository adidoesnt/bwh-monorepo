import type { BookingStatus, SessionType } from '@repo/database/schema';

export const SESSION_TYPES = [
	'1:1 in-person',
	'1:1 online',
	'free consult',
	'assessment',
] as const satisfies readonly SessionType[];

/** Session types that don't need coach and client in the same place. */
export const ONLINE_TYPES: readonly SessionType[] = ['1:1 online', 'free consult'];

/** The only session type bookable before the PAR-Q screening is submitted. */
export const PRE_SCREENING_TYPES: readonly SessionType[] = ['free consult'];

/** Free consults aren't drawn from a package; they run this long. */
export const CONSULT_MIN = 30;

export const durationNote: Record<number, string> = {
	30: 'short session',
	45: 'quick session · technique or a top-up',
	60: 'standard session',
	90: 'long session · full assessment or two focuses',
};

export const ONLINE_LOCATION = 'online (video call)';

/** Sticker price of a package: per-session price × session count. */
export function packageTotalCents(p: {
	pricePerSessionCents: number;
	sessionCount: number;
}): number {
	return p.pricePerSessionCents * p.sessionCount;
}

// ─── Cancellation & reschedule policy ────────────────────────────────────────

/** Hours before a session after which cancelling forfeits the session. Hardcoded
 *  until Phase 10's admin settings. */
export const CANCELLATION_WINDOW_HOURS = 24;

/**
 * What cancelling a booking does to the client's package:
 * - `none`    — nothing was consumed yet (still awaiting approval)
 * - `return`  — confirmed & outside the window → session goes back to the pack
 * - `forfeit` — confirmed & inside the window → session is used, nothing back
 * - `blocked` — already completed/cancelled, nothing to do
 */
export type CancelOutcome = 'none' | 'return' | 'forfeit' | 'blocked';

export function cancelOutcome(
	status: BookingStatus,
	startsAt: Date,
	now: Date = new Date(),
): CancelOutcome {
	if (status === 'completed' || status === 'cancelled') return 'blocked';
	// pending_approval (+ any pre-6 pending_* rows) — no session drawn yet
	if (status !== 'confirmed') return 'none';
	const hoursOut = (startsAt.getTime() - now.getTime()) / 3_600_000;
	return hoursOut >= CANCELLATION_WINDOW_HOURS ? 'return' : 'forfeit';
}

/** A confirmed session can only be moved while still outside the window; a
 *  pending request always, settled ones never. */
export function canReschedule(
	status: BookingStatus,
	startsAt: Date,
	now: Date = new Date(),
): boolean {
	if (status === 'pending_approval') return true;
	if (status !== 'confirmed') return false;
	return (startsAt.getTime() - now.getTime()) / 3_600_000 >= CANCELLATION_WINDOW_HOURS;
}
