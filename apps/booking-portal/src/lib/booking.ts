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

export const DURATIONS = [45, 60, 90] as const;
export type Duration = (typeof DURATIONS)[number];

/** Credit cost as the `numeric(4,2)` string the `booking.credit_cost` column wants. */
export function creditCostFor(type: SessionType, durationMin: number): string {
	if (type === 'free consult') return '0.00';
	if (durationMin === 45) return '0.75';
	if (durationMin === 90) return '1.50';
	return '1.00';
}

export const durationNote: Record<number, string> = {
	45: 'quick session · technique or a top-up',
	60: 'standard session',
	90: 'long session · full assessment or two focuses',
};

export const ONLINE_LOCATION = 'online (video call)';

/** Cash price of a session: coach's rate treated as hourly, scaled to the duration. */
export function sessionAmountCents(rateFromCents: number, durationMin: number): number {
	return Math.round((rateFromCents * durationMin) / 60);
}

// ─── Cancellation & reschedule policy ────────────────────────────────────────

/** Hours before a session after which cancelling forfeits the credit. Hardcoded
 *  until Phase 10's admin settings. */
export const CANCELLATION_WINDOW_HOURS = 24;

/**
 * What cancelling a booking does to the client's credits / invoices:
 * - `none`    — no credit was ever taken (pending approval/payment) → plain cancel
 * - `void`    — a paynow proof is in flight → void its unverified invoice
 * - `refund`  — confirmed & outside the window → return the credit
 * - `forfeit` — confirmed & inside the window → credit is used, session lost
 * - `blocked` — already completed/cancelled, nothing to do
 */
export type CancelOutcome = 'none' | 'void' | 'refund' | 'forfeit' | 'blocked';

export function cancelOutcome(
	status: BookingStatus,
	startsAt: Date,
	now: Date = new Date(),
): CancelOutcome {
	if (status === 'completed' || status === 'cancelled') return 'blocked';
	if (status === 'pending_approval' || status === 'pending_payment') return 'none';
	if (status === 'pending_verification') return 'void';
	// confirmed
	const hoursOut = (startsAt.getTime() - now.getTime()) / 3_600_000;
	return hoursOut >= CANCELLATION_WINDOW_HOURS ? 'refund' : 'forfeit';
}

/** A confirmed session can only be moved while still outside the window; other
 *  live statuses are always reschedulable, settled ones never. */
export function canReschedule(
	status: BookingStatus,
	startsAt: Date,
	now: Date = new Date(),
): boolean {
	if (status === 'pending_approval' || status === 'pending_payment') return true;
	if (status !== 'confirmed') return false;
	return (startsAt.getTime() - now.getTime()) / 3_600_000 >= CANCELLATION_WINDOW_HOURS;
}
