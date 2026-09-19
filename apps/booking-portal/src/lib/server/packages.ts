import { fail, isHttpError, isRedirect } from "@sveltejs/kit";
import { sql } from "drizzle-orm";
import { MAX_ACTIVE_PACKAGES } from "./config";
import { db } from "./db";
import {
  getClientActivePackageCount,
  purchasePackage,
  type DbExecutor,
} from "./queries";

/** Why a client can't buy another package right now, or `null` if they can. */
export const getPurchaseBlockReason = async (
  clientId: string,
  executor: DbExecutor = db,
) => {
  const activeCount = await getClientActivePackageCount(clientId, executor);
  if (activeCount >= MAX_ACTIVE_PACKAGES) {
    return `you can hold up to ${MAX_ACTIVE_PACKAGES} active packages — use or wait out one before buying another`;
  }
  return null;
};

/** Buys a package, enforcing the active-package cap. Every `?/buy` action
 * goes through this so the cap can't be bypassed.
 *
 * The advisory lock serializes one client's concurrent purchases (released
 * when the transaction ends), so a second request waits for the first to
 * commit and then sees the updated count instead of racing past the cap. */
export const buyPackage = (
  clientId: string,
  pkg: Parameters<typeof purchasePackage>[0]["pkg"],
) =>
  db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${clientId}))`);

    const reason = await getPurchaseBlockReason(clientId, tx);
    if (reason) return { ok: false as const, reason };

    const purchase = await purchasePackage({ clientId, pkg }, tx);
    return { ok: true as const, purchase };
  });

/** For a `?/buy` action's `catch`: turns an unexpected failure (DB down, a
 * failed insert, …) into a `fail(500)` so the client stays on the page with
 * their selection instead of landing on SvelteKit's bare error page.
 * `redirect()` and `error()` work by throwing, so those are rethrown. */
export const purchaseFailure = (err: unknown) => {
  if (isRedirect(err) || isHttpError(err)) throw err;

  console.error("package purchase failed", err);
  return fail(500, {
    message: "we couldn't complete your purchase — please try again",
  });
};
