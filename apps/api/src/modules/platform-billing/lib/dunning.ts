import type { FastifyBaseLogger } from "fastify";
import type { Database } from "@platform/db";
import {
  lockExpiredGracePeriods,
  processExpiredLockedSubscriptions,
} from "./platform-subscriptions-store.js";

export interface DunningTickResult {
  locked: string[];
  expired: string[];
}

/**
 * Dunning sequence (locked decisions from Part A of the session bundle):
 *
 *   payment fails
 *     → status: past_due, grace_period_ends_at = NOW() + 48h  (markSubscriptionPastDue)
 *   48h passes without payment
 *     → status: locked, locked_at = NOW()                     (lockExpiredGracePeriods — this fn)
 *   90 days still inactive
 *     → status: cancelled, org suspended                      (processExpiredLockedSubscriptions)
 *
 * No auto-cancel step between locked and the 90-day mark — data is intact
 * and the subscription state is preserved until the org actively recovers
 * or the 90-day window closes.
 *
 * This function is the cron tick — call it on a regular schedule (e.g. hourly).
 */
export async function runDunningTick(
  db: Database,
  log: FastifyBaseLogger,
): Promise<DunningTickResult> {
  const locked = await lockExpiredGracePeriods(db);
  if (locked.length > 0) {
    log.info({ count: locked.length, orgIds: locked }, "platform-billing: locked accounts after grace period");
  }

  const expired = await processExpiredLockedSubscriptions(db);
  if (expired.length > 0) {
    log.warn({ count: expired.length, orgIds: expired }, "platform-billing: suspended accounts after 90-day lock");
  }

  return { locked, expired };
}
