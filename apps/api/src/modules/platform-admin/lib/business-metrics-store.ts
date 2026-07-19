import { type Database } from "@platform/db";
import type { PnlResponse, AdPerformanceResponse } from "@platform/shared-types";
import { computeRevenueSplit } from "../../platform-billing/lib/metrics/revenue-split.js";
import { computeMargin } from "./credits-store.js";
import { sumExpensesByCategory, totalAdvertisingSpend } from "./expenses-store.js";
import { getSnapshotsInRange, getSnapshotOnOrBefore } from "../../platform-billing/lib/metrics/metric-snapshots-store.js";
import { computeCurrentMrr } from "../../platform-billing/lib/metrics/mrr.js";

const ALL_PARENT_CATEGORIES = ["advertising", "marketing", "building", "operational"] as const;

export async function computePnl(db: Database, from: Date, to: Date): Promise<PnlResponse> {
  const [revenueSplit, creditMargin, expenseSums] = await Promise.all([
    computeRevenueSplit(db, from, to),
    computeMargin(db),
    sumExpensesByCategory(db, from, to),
  ]);

  const subscriptionRevenueCents = revenueSplit.subscription.netCents;
  const creditMarginCents = creditMargin.aggregateMarginCents;
  const totalRevenueCents = subscriptionRevenueCents + creditMarginCents;

  const expenseMap = new Map(expenseSums.map((e) => [e.parentCategory, e.totalCents]));
  const expensesByCategory = ALL_PARENT_CATEGORIES.map((cat) => {
    const totalCents = expenseMap.get(cat) ?? 0;
    return {
      parentCategory: cat,
      totalCents,
      pctOfRevenue: totalRevenueCents > 0 ? (totalCents / totalRevenueCents) * 100 : null,
    };
  });

  const totalExpensesCents = expensesByCategory.reduce((s, e) => s + e.totalCents, 0);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    subscriptionRevenueCents,
    creditMarginCents,
    totalRevenueCents,
    expensesByCategory,
    totalExpensesCents,
    netProfitCents: totalRevenueCents - totalExpensesCents,
  };
}

export async function computeAdPerformance(
  db: Database,
  from: Date,
  to: Date,
): Promise<AdPerformanceResponse> {
  const [adSpend, snapshots, mrr] = await Promise.all([
    totalAdvertisingSpend(db, from, to),
    getSnapshotsInRange(db, from, to),
    computeCurrentMrr(db, to),
  ]);

  const paidConversions = snapshots.reduce((sum, s) => sum + s.conversions, 0);

  const cacCents = paidConversions > 0 ? Math.round(adSpend / paidConversions) : null;

  // LTV = ARPU × avg months retained. Needs churn data.
  const startSnapshot = await getSnapshotOnOrBefore(db, from);
  let ltvCents: number | null = null;
  let isEarlyEstimate = true;

  const arpuCents = mrr.activeSubscriptions > 0
    ? mrr.mrrCents / mrr.activeSubscriptions
    : 0;

  if (startSnapshot && startSnapshot.activeSubscriptions > 0) {
    const churned = snapshots.reduce((sum, s) => sum + s.churnedCount, 0);
    const churnRate = churned / startSnapshot.activeSubscriptions;
    if (churnRate > 0) {
      const monthsRetained = 1 / churnRate;
      ltvCents = Math.round(arpuCents * monthsRetained);
    }
    // 3+ months of data = not an early estimate
    const rangeMs = to.getTime() - from.getTime();
    if (rangeMs >= 90 * 86400000) {
      isEarlyEstimate = false;
    }
  }

  let ltvToCacRatio: number | null = null;
  let paybackMonths: number | null = null;
  if (ltvCents !== null && cacCents !== null && cacCents > 0) {
    ltvToCacRatio = Math.round((ltvCents / cacCents) * 10) / 10;
    if (arpuCents > 0) {
      paybackMonths = Math.round((cacCents / arpuCents) * 10) / 10;
    }
  }

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    totalAdSpendCents: adSpend,
    paidConversions,
    cacCents,
    actualLtvCents: ltvCents,
    ltvToCacRatio,
    paybackMonths,
    isEarlyEstimate,
  };
}
