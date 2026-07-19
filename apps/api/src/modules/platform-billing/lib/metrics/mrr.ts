import { and, eq, gt, lte, or, inArray } from "drizzle-orm";
import {
  platformSubscriptions,
  platformPlans,
  organization,
  type Database,
} from "@platform/db";

export interface MrrBreakdown {
  mrrCents: number;
  arrCents: number;
  // "currently paying subscribers" = status active, org not suspended.
  activeSubscriptions: number;
  // active count keyed by plan name (starter/growth/pro).
  activeByTier: Record<string, number>;
}

/**
 * Monthly-equivalent of a subscription's recurring price.
 *
 * LOCKED RULE: annual subscriptions contribute their monthly equivalent
 * (annual price ÷ 12), never the lump annual amount. A tenant paying
 * ₦120,000/year contributes ₦10,000 MRR.
 */
export function monthlyEquivalentCents(
  plan: { priceMonthlyCents: number; priceAnnuallyCents: number },
  billingInterval: string,
): number {
  if (billingInterval === "annual") {
    return Math.round(plan.priceAnnuallyCents / 12);
  }
  return plan.priceMonthlyCents;
}

/**
 * Computes MRR/ARR and the active-subscription counts as of now.
 *
 * MRR rules (SuperAdmin.docx Tab 1, LAYER 4):
 *   • active monthly subs count at their monthly price
 *   • annual subs count at price ÷ 12
 *   • trial → 0, suspended org → 0
 *   • a cancelled account still within its cycle contributes until cycle end
 *
 * "Active subscriptions" (the headline count) is stricter — currently *paying*
 * subscribers only (status = active), so a cancelled-in-cycle account adds to
 * MRR but not to the active count. Both are derived from one query.
 *
 * `cohortCreatedOnOrBefore` restricts to orgs that existed by a given date —
 * used by NRR, which measures the existing cohort only, excluding new signups.
 */
export async function computeCurrentMrr(
  db: Database,
  now: Date,
  cohortCreatedOnOrBefore?: Date,
): Promise<MrrBreakdown> {
  const rows = await db
    .select({
      status: platformSubscriptions.status,
      billingInterval: platformSubscriptions.billingInterval,
      currentPeriodEnd: platformSubscriptions.currentPeriodEnd,
      planName: platformPlans.name,
      priceMonthlyCents: platformPlans.priceMonthlyCents,
      priceAnnuallyCents: platformPlans.priceAnnuallyCents,
    })
    .from(platformSubscriptions)
    .innerJoin(platformPlans, eq(platformSubscriptions.planId, platformPlans.id))
    .innerJoin(organization, eq(platformSubscriptions.organizationId, organization.id))
    .where(
      and(
        eq(organization.status, "active"),
        cohortCreatedOnOrBefore
          ? lte(organization.createdAt, cohortCreatedOnOrBefore)
          : undefined,
        or(
          eq(platformSubscriptions.status, "active"),
          and(
            eq(platformSubscriptions.status, "cancelled"),
            gt(platformSubscriptions.currentPeriodEnd, now),
          ),
        ),
      ),
    );

  let mrrCents = 0;
  let activeSubscriptions = 0;
  const activeByTier: Record<string, number> = {};

  for (const row of rows) {
    const monthly = monthlyEquivalentCents(row, row.billingInterval);
    // Both active and cancelled-in-cycle rows contribute to MRR.
    mrrCents += monthly;
    // Only status=active counts as a "currently paying subscriber".
    if (row.status === "active") {
      activeSubscriptions += 1;
      activeByTier[row.planName] = (activeByTier[row.planName] ?? 0) + 1;
    }
  }

  return {
    mrrCents,
    arrCents: mrrCents * 12,
    activeSubscriptions,
    activeByTier,
  };
}

/** Count of accounts currently in trial (status=trial, org not suspended). */
export async function countTrialAccounts(db: Database): Promise<number> {
  const rows = await db
    .select({ id: platformSubscriptions.id })
    .from(platformSubscriptions)
    .innerJoin(organization, eq(platformSubscriptions.organizationId, organization.id))
    .where(
      and(
        eq(platformSubscriptions.status, "trial"),
        eq(organization.status, "active"),
      ),
    );
  return rows.length;
}

/**
 * Subscriptions currently in the dunning pipeline, with their stage.
 * past_due = within the 48h grace window; locked = grace expired, data intact.
 */
export async function listDunningSubscriptions(
  db: Database,
): Promise<Array<{ organizationId: string; stage: "grace" | "locked" }>> {
  const rows = await db
    .select({
      organizationId: platformSubscriptions.organizationId,
      status: platformSubscriptions.status,
    })
    .from(platformSubscriptions)
    .where(inArray(platformSubscriptions.status, ["past_due", "locked"]));
  return rows.map((r) => ({
    organizationId: r.organizationId,
    stage: r.status === "locked" ? "locked" : "grace",
  }));
}
