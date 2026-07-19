import { eq, and, lt, isNotNull } from "drizzle-orm";
import { platformSubscriptions, organization, type Database } from "@platform/db";

export type PlatformSubscriptionRow = typeof platformSubscriptions.$inferSelect;

// Copies the converting signup's UTMs from the org onto the new subscription
// ("every subscription carries the same UTMs from the signup that converted").
async function readSignupUtms(db: Database, organizationId: string) {
  const [org] = await db
    .select({
      utmSource: organization.signupUtmSource,
      utmMedium: organization.signupUtmMedium,
      utmCampaign: organization.signupUtmCampaign,
      utmContent: organization.signupUtmContent,
      utmTerm: organization.signupUtmTerm,
    })
    .from(organization)
    .where(eq(organization.id, organizationId));
  return org ?? {};
}

export async function findSubscriptionByOrg(
  db: Database,
  organizationId: string,
): Promise<PlatformSubscriptionRow | null> {
  const [row] = await db
    .select()
    .from(platformSubscriptions)
    .where(eq(platformSubscriptions.organizationId, organizationId));
  return row ?? null;
}

export async function createSubscription(
  db: Database,
  params: {
    organizationId: string;
    planId: string;
    billingInterval: "monthly" | "annual";
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    trialEndsAt?: Date;
    paystackSubscriptionCode?: string;
    paystackCustomerCode?: string;
  },
): Promise<PlatformSubscriptionRow> {
  const utms = await readSignupUtms(db, params.organizationId);
  const [row] = await db
    .insert(platformSubscriptions)
    .values({
      ...params,
      ...utms,
      status: params.trialEndsAt ? "trial" : "active",
    })
    .returning();
  return row!;
}

// Called when Paystack confirms a successful charge.
export async function markSubscriptionActive(
  db: Database,
  organizationId: string,
  updates: { currentPeriodStart: Date; currentPeriodEnd: Date },
): Promise<void> {
  await db
    .update(platformSubscriptions)
    .set({
      status: "active",
      gracePeriodEndsAt: null,
      lockedAt: null,
      updatedAt: new Date(),
      ...updates,
    })
    .where(eq(platformSubscriptions.organizationId, organizationId));
}

// Called when Paystack reports payment failure — starts the 48h grace clock.
export async function markSubscriptionPastDue(
  db: Database,
  organizationId: string,
): Promise<void> {
  const gracePeriodEndsAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  await db
    .update(platformSubscriptions)
    .set({ status: "past_due", gracePeriodEndsAt, updatedAt: new Date() })
    .where(
      and(
        eq(platformSubscriptions.organizationId, organizationId),
        eq(platformSubscriptions.status, "active"),
      ),
    );
}

// Cron: lock all past_due subscriptions whose grace window has closed.
// Returns the list of affected organization IDs.
export async function lockExpiredGracePeriods(db: Database): Promise<string[]> {
  const now = new Date();
  const rows = await db
    .update(platformSubscriptions)
    .set({ status: "locked", lockedAt: now, updatedAt: now })
    .where(
      and(
        eq(platformSubscriptions.status, "past_due"),
        lt(platformSubscriptions.gracePeriodEndsAt, now),
      ),
    )
    .returning({ organizationId: platformSubscriptions.organizationId });
  return rows.map((r) => r.organizationId);
}

// Cron: find locked subscriptions inactive for ≥ 90 days — marks them
// cancelled and suspends the organization. Data deletion is intentionally
// deferred to a manual step or a separate scheduled job to allow recovery.
export async function processExpiredLockedSubscriptions(
  db: Database,
): Promise<string[]> {
  const threshold = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const rows = await db
    .update(platformSubscriptions)
    .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(platformSubscriptions.status, "locked"),
        isNotNull(platformSubscriptions.lockedAt),
        lt(platformSubscriptions.lockedAt, threshold),
      ),
    )
    .returning({ organizationId: platformSubscriptions.organizationId });

  const orgIds = rows.map((r) => r.organizationId);
  if (orgIds.length > 0) {
    // Suspend orgs whose subscriptions have expired past the 90-day window.
    for (const orgId of orgIds) {
      await db
        .update(organization)
        .set({ status: "suspended" })
        .where(eq(organization.id, orgId));
    }
  }
  return orgIds;
}

export async function cancelSubscription(
  db: Database,
  organizationId: string,
): Promise<void> {
  await db
    .update(platformSubscriptions)
    .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
    .where(eq(platformSubscriptions.organizationId, organizationId));
}
