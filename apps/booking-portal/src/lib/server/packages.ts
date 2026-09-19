import { MAX_ACTIVE_PACKAGES } from "./config";
import { getClientActivePackageCount } from "./queries";

/** Why a client can't buy another package right now, or `null` if they can.
 * Shared by every `?/buy` action so the cap is enforced in one place.
 *
 * TODO: this check and `purchasePackage`'s inserts aren't in one transaction,
 * so two simultaneous requests can both pass and exceed the cap. */
export const getPurchaseBlockReason = async (clientId: string) => {
  const activeCount = await getClientActivePackageCount(clientId);
  if (activeCount >= MAX_ACTIVE_PACKAGES) {
    return `you can hold up to ${MAX_ACTIVE_PACKAGES} active packages — use or wait out one before buying another`;
  }
  return null;
};
