import type { BookingStatus } from '@repo/database/schema';

/** daisyUI badge class per booking status. */
export const statusPill: Record<BookingStatus, string> = {
	confirmed: 'badge-success',
	completed: 'badge-ghost',
	pending_approval: 'badge-ghost',
	pending_payment: 'badge-warning',
	cancelled: 'badge-ghost',
};

export const statusLabel: Record<BookingStatus, string> = {
	confirmed: 'confirmed',
	completed: 'completed',
	pending_approval: 'awaiting approval',
	pending_payment: 'payment due',
	cancelled: 'cancelled',
};
