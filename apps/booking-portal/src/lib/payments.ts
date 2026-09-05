/** Shared with the client — the server-only flag check lives in $lib/server/payments. */
export const STRIPE_NOT_IMPLEMENTED =
	"card payments (stripe) aren't built yet — set ENABLE_STRIPE_PAYMENTS=false " +
	'in apps/booking-portal/.env to use the paynow flow instead.';
