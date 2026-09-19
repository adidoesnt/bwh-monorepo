import { fail, isHttpError, isRedirect } from "@sveltejs/kit";

/** For a form action's `catch`: turns an unexpected failure (DB down, a
 * failed insert, …) into a `fail(500)` so the client stays on the page with
 * their selection instead of landing on SvelteKit's bare error page.
 * `redirect()` and `error()` work by throwing, so those are rethrown. */
export const actionFailure = (err: unknown, message: string) => {
  if (isRedirect(err) || isHttpError(err)) throw err;

  console.error(message, err);
  return fail(500, { message });
};
