import type { SessionLedgerReason } from "@repo/database/schema";

const firstName = (name: string) => name.split(" ")[0] ?? name;

/** One-line label for a session-ledger movement, shared by the dashboard card,
 *  the packages page and the full activity log. */
export function ledgerLabel(e: {
  reason: SessionLedgerReason;
  delta: number;
  coachName: string;
  packageName?: string;
}): string {
  const coach = firstName(e.coachName);
  switch (e.reason) {
    case "purchase":
      return e.packageName
        ? `bought ${e.packageName} · ${coach}`
        : `bought a package · ${coach}`;
    case "session_consumed":
      return `session with ${coach}`;
    case "returned_in_time":
      return `session returned · ${coach}`;
    default:
      return `${e.delta > 0 ? "+" : ""}${e.delta} adjustment · ${coach}`;
  }
}
