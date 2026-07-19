import type { Database } from "@platform/db";
import type { OverviewTrendsResponse } from "@platform/shared-types";
import { getSnapshotsInRange, type MetricSnapshotRow } from "./metric-snapshots-store.js";
import { toDateString } from "./activity-store.js";

export type TrendMetric = "mrr" | "churn" | "conversion" | "revenue";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/**
 * Weekly trend series for a metric over the trailing N weeks, from the daily
 * snapshot store. Weeks with no snapshots yield a 0 point (honest — nothing was
 * recorded), so the line is continuous rather than gapped.
 */
export async function getTrends(
  db: Database,
  metric: TrendMetric,
  weeks: number,
  now: Date,
): Promise<OverviewTrendsResponse> {
  const windowStart = new Date(now.getTime() - weeks * WEEK_MS);
  const snapshots = await getSnapshotsInRange(db, windowStart, now);

  // Bucket snapshots into week indices [0, weeks).
  const buckets: MetricSnapshotRow[][] = Array.from({ length: weeks }, () => []);
  for (const snap of snapshots) {
    const snapDate = new Date(`${snap.snapshotDate}T00:00:00.000Z`);
    const idx = Math.floor((snapDate.getTime() - windowStart.getTime()) / WEEK_MS);
    if (idx >= 0 && idx < weeks) buckets[idx]!.push(snap);
  }

  const points = buckets.map((bucket, i) => {
    const weekStart = toDateString(new Date(windowStart.getTime() + i * WEEK_MS));
    return { weekStart, value: valueFor(metric, bucket) };
  });

  return { metric, weeks, points };
}

function valueFor(metric: TrendMetric, bucket: MetricSnapshotRow[]): number {
  if (bucket.length === 0) return 0;
  switch (metric) {
    case "mrr":
      // End-of-week MRR (last snapshot in the week).
      return bucket[bucket.length - 1]!.mrrCents;
    case "revenue":
      // Total collected during the week (both streams).
      return bucket.reduce((s, x) => s + x.subscriptionRevenueCents + x.creditRevenueCents, 0);
    case "conversion": {
      const trialStarts = bucket.reduce((s, x) => s + x.trialStarts, 0);
      const conversions = bucket.reduce((s, x) => s + x.conversions, 0);
      return trialStarts > 0 ? Math.round((conversions / trialStarts) * 1000) / 10 : 0;
    }
    case "churn": {
      const churned = bucket.reduce((s, x) => s + x.churnedCount, 0);
      // Active at week start = first snapshot's active count.
      const activeAtStart = bucket[0]!.activeSubscriptions;
      return activeAtStart > 0 ? Math.round((churned / activeAtStart) * 1000) / 10 : 0;
    }
  }
}
