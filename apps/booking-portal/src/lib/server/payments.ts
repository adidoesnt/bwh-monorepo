import { ENABLE_STRIPE_PAYMENTS } from "./config";

/** false (default) → paynow flow; true → stripe, not built yet (see STRIPE_NOT_IMPLEMENTED). */
export const stripeEnabled = () => ENABLE_STRIPE_PAYMENTS;

export { STRIPE_NOT_IMPLEMENTED } from "$lib/payments";
