import { and, eq, gte, lte, lt, desc, sql, isNotNull } from "drizzle-orm";
import {
  platformMetricSnapshots,
  platformSubscriptions,
  platformTransactions,
  organization,
  type Database,
} from "@platform/db";
import { computeCurrentMrr, countTrialAccounts } from "./mrr.js";
import { computeRevenueSplit } from "./revenue-split.js";
import { toDateString } from "./activity-store.js";

export type MetricSnapshotRow = typeof platformMetricSnapshots.$inferSelect;

function startOfUtcDay(d: Date): Date {
  return new Date(`${toDateString(d)}T00:00:00.000Z`);
}

/**
 * Computes today's platform state and upserts it as the snapshot for today.
 * Idempotent per day — re-running overwrites today's row with fresh numbers.
 * Run daily by the metrics-snapshot cron; the resulting series backs churn,
 * NRR, and the trend lines, which need point-in-time history.
 */
export async function computeAndWriteTodaySnapshot(
  db: Database,
  now: Date,
): Promise<MetricSnapshotRow> {
  const dayStart = startOfUtcDay(now);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const [mrr, trialAccounts, dayRevenue] = await Promise.all([
    computeCurrentMrr(db, now),
    countTrialAccounts(db),
    computeRevenueSplit(db, dayStart, dayEnd),
  ]);

  // Daily flow counters (all cleanly derivable from single timestamps).
  const [signupRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(organization)
    .where(and(gte(organization.createdAt, dayStart), lt(organization.createdAt, dayEnd)));

  const [trialStartRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(platformSubscriptions)
    .where(
      and(
        gte(platformSubscriptions.createdAt, dayStart),
        lt(platformSubscriptions.createdAt, dayEnd),
        isNotNull(platformSubscriptions.trialEndsAt),
      ),
    );

  const [churnRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(platformSubscriptions)
    .where(
      and(
        isNotNull(platformSubscriptions.cancelledAt),
        gte(platformSubscriptions.cancelledAt, dayStart),
        lt(platformSubscriptions.cancelledAt, dayEnd),
      ),
    );

  const conversions = await countConversionsInDay(db, dayStart, dayEnd);

  const values = {
    snapshotDate: toDateString(now),
    mrrCents: mrr.mrrCents,
    arrCents: mrr.arrCents,
    activeSubscriptions: mrr.activeSubscriptions,
    trialAccounts,
    activeByTier: mrr.activeByTier,
    subscriptionRevenueCents: dayRevenue.subscription.grossCents,
    creditRevenueCents: dayRevenue.credit.grossCents,
    newSignups: signupRow?.n ?? 0,
    trialStarts: trialStartRow?.n ?? 0,
    conversions,
    churnedCount: churnRow?.n ?? 0,
    capturedAt: now,
  };

  const [row] = await db
    .insert(platformMetricSnapshots)
    .values(values)
    .onConflictDoUpdate({
      target: [platformMetricSnapshots.snapshotDate],
      set: values,
    })
    .returning();
  return row!;
}

/**
 * A conversion = a trial-origin org's FIRST successful subscription charge.
 * Using the first successful charge (not a status field) makes this exact and
 * immune to renewals, without needing a state-transition log. Computed in JS
 * from the (small) success-transaction set.
 */
async function countConversionsInDay(db: Database, dayStart: Date, dayEnd: Date): Promise<number> {
  const txns = await db
    .select({
      organizationId: platformTransactions.organizationId,
      createdAt: platformTransactions.createdAt,
    })
    .from(platformTransactions)
    .where(
      and(
        eq(platformTransactions.type, "subscription"),
        eq(platformTransactions.status, "success"),
      ),
    );

  const firstByOrg = new Map<string, Date>();
  for (const t of txns) {
    // organization_id is nulled when a tenant is deleted; such ledger rows
    // survive for revenue integrity but can't be attributed to a conversion.
    if (!t.organizationId) continue;
    const prev = firstByOrg.get(t.organizationId);
    if (!prev || t.createdAt < prev) firstByOrg.set(t.organizationId, t.createdAt);
  }

  const trialOrgs = await db
    .select({ organizationId: platformSubscriptions.organizationId })
    .from(platformSubscriptions)
    .where(isNotNull(platformSubscriptions.trialEndsAt));
  const trialOrgSet = new Set(trialOrgs.map((r) => r.organizationId));

  let conversions = 0;
  for (const [orgId, firstAt] of firstByOrg) {
    if (firstAt >= dayStart && firstAt < dayEnd && trialOrgSet.has(orgId)) conversions += 1;
  }
  return conversions;
}

export async function getLatestSnapshot(db: Database): Promise<MetricSnapshotRow | null> {
  const [row] = await db
    .select()
    .from(platformMetricSnapshots)
    .orderBy(desc(platformMetricSnapshots.snapshotDate))
    .limit(1);
  return row ?? null;
}

/** Latest snapshot on or before a date — the "state at period start" source. */
export async function getSnapshotOnOrBefore(
  db: Database,
  date: Date,
): Promise<MetricSnapshotRow | null> {
  const [row] = await db
    .select()
    .from(platformMetricSnapshots)
    .where(lte(platformMetricSnapshots.snapshotDate, toDateString(date)))
    .orderBy(desc(platformMetricSnapshots.snapshotDate))
    .limit(1);
  return row ?? null;
}

export async function getSnapshotsInRange(
  db: Database,
  from: Date,
  to: Date,
): Promise<MetricSnapshotRow[]> {
  return db
    .select()
    .from(platformMetricSnapshots)
    .where(
      and(
        gte(platformMetricSnapshots.snapshotDate, toDateString(from)),
        lte(platformMetricSnapshots.snapshotDate, toDateString(to)),
      ),
    )
    .orderBy(platformMetricSnapshots.snapshotDate);
}
