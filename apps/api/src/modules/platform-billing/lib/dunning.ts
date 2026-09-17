import type { FastifyBaseLogger } from "fastify";
import { and, eq } from "drizzle-orm";
import { member, user, type Database } from "@platform/db";
import {
  lockExpiredGracePeriods,
  processExpiredLockedSubscriptions,
} from "./platform-subscriptions-store.js";
import { sendEmail } from "../../auth/lib/email.js";

export interface DunningTickResult {
  locked: string[];
  expired: string[];
}

async function findOrgOwnerEmail(db: Database, organizationId: string): Promise<string | null> {
  const [row] = await db
    .select({ email: user.email })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(and(eq(member.organizationId, organizationId), eq(member.role, "owner")))
    .limit(1);
  return row?.email ?? null;
}

/** Best-effort owner notification - a failed send never blocks the dunning state transition itself. */
async function notifyOwners(
  db: Database,
  log: FastifyBaseLogger,
  organizationIds: string[],
  subject: string,
  body: string,
): Promise<void> {
  for (const organizationId of organizationIds) {
    const email = await findOrgOwnerEmail(db, organizationId);
    if (!email) {
      log.warn({ organizationId }, "dunning: no owner email found, skipping notification");
      continue;
    }
    try {
      await sendEmail(log, { to: email, subject, body });
    } catch (err) {
      log.error({ err, organizationId }, "dunning: failed to send owner notification");
    }
  }
}

/** Sent immediately when Paystack reports a failed charge (webhooks.ts's handlePaymentFailed). */
export async function notifyPaymentFailed(db: Database, log: FastifyBaseLogger, organizationId: string): Promise<void> {
  await notifyOwners(
    db,
    log,
    [organizationId],
    "Payment failed - action needed",
    "Your last subscription payment didn't go through. You have 48 hours to update your payment details before your account is locked.",
  );
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
    await notifyOwners(
      db,
      log,
      locked,
      "Your account has been locked",
      "Your grace period has ended without a successful payment, and your account is now locked. Update your payment details to restore access.",
    );
  }

  const expired = await processExpiredLockedSubscriptions(db);
  if (expired.length > 0) {
    log.warn({ count: expired.length, orgIds: expired }, "platform-billing: suspended accounts after 90-day lock");
    await notifyOwners(
      db,
      log,
      expired,
      "Your subscription has been cancelled",
      "Your account was locked for 90 days without payment and has now been cancelled. Contact support if you'd like to discuss reactivation.",
    );
  }

  return { locked, expired };
}
