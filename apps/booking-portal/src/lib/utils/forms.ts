import type { ActionResult } from '@sveltejs/kit';

export const NETWORK_ERROR_MESSAGE = "couldn't reach the server — check your connection and try again";

/** In a `use:enhance` callback: whether the request itself failed (offline,
 * dropped connection, unreadable response) rather than the server returning
 * an error. SvelteKit only sets `status` on errors the server returned, so
 * showing the default error page for one of these would just discard the
 * user's in-progress form for something a retry can fix. */
export const isNetworkFailure = (result: ActionResult) =>
	result.type === 'error' && result.status === undefined;
