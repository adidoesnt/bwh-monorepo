import type { SessionType } from '@repo/database/schema';

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
