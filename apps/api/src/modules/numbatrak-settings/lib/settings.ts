import { eq } from "drizzle-orm";
import { platformSubscriptions, platformPlans, type Database } from "@platform/db";

export async function getSubscriptionForOrg(db: Database, organizationId: string) {
  const [sub] = await db
    .select({
      id: platformSubscriptions.id,
      planId: platformSubscriptions.planId,
      status: platformSubscriptions.status,
      billingInterval: platformSubscriptions.billingInterval,
      currentPeriodStart: platformSubscriptions.currentPeriodStart,
      currentPeriodEnd: platformSubscriptions.currentPeriodEnd,
      trialEndsAt: platformSubscriptions.trialEndsAt,
      gracePeriodEndsAt: platformSubscriptions.gracePeriodEndsAt,
      cancelledAt: platformSubscriptions.cancelledAt,
      createdAt: platformSubscriptions.createdAt,
    })
    .from(platformSubscriptions)
    .where(eq(platformSubscriptions.organizationId, organizationId));

  if (!sub) return null;

  let planName: string | null = null;
  let planDisplayName: string | null = null;
  if (sub.planId) {
    const [plan] = await db
      .select({ name: platformPlans.name, displayName: platformPlans.displayName })
      .from(platformPlans)
      .where(eq(platformPlans.id, sub.planId));
    if (plan) {
      planName = plan.name;
      planDisplayName = plan.displayName;
    }
  }

  return {
    id: sub.id,
    planId: sub.planId,
    planName,
    planDisplayName,
    status: sub.status,
    billingInterval: sub.billingInterval,
    currentPeriodStart: sub.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
    gracePeriodEndsAt: sub.gracePeriodEndsAt?.toISOString() ?? null,
    cancelledAt: sub.cancelledAt?.toISOString() ?? null,
    createdAt: sub.createdAt?.toISOString() ?? null,
  };
}

export async function getAvailablePlans(db: Database) {
  const plans = await db
    .select()
    .from(platformPlans)
    .where(eq(platformPlans.isActive, true))
    .orderBy(platformPlans.priceMonthlyCents);

  return plans.map((p) => ({
    id: p.id,
    name: p.name,
    displayName: p.displayName,
    priceMonthlyCents: p.priceMonthlyCents,
    priceAnnuallyCents: p.priceAnnuallyCents,
    limits: p.limits,
  }));
}
