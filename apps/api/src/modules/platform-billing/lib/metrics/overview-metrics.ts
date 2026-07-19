import { and, eq, gte, lte, sql } from "drizzle-orm";
import { organization, type Database } from "@platform/db";
import type { OverviewResponse } from "@platform/shared-types";
import { computeCurrentMrr, countTrialAccounts, listDunningSubscriptions } from "./mrr.js";
import { computeRevenueSplit } from "./revenue-split.js";
import { getDauMau } from "./activity-store.js";
import { getSnapshotOnOrBefore, getSnapshotsInRange } from "./metric-snapshots-store.js";
import { evaluateHealth } from "./health.js";

const DEFAULT_RANGE_DAYS = 30;

export interface OverviewParams {
  from?: string;
  to?: string;
}

async function countNewSignupsBySource(
  db: Database,
  from: Date,
  to: Date,
): Promise<{ total: number; bySource: Array<{ source: string; count: number }> }> {
  const rows = await db
    .select({
      source: sql<string | null>`${organization.signupUtmSource}`,
      count: sql<number>`count(*)::int`,
    })
    .from(organization)
    .where(and(gte(organization.createdAt, from), lte(organization.createdAt, to)))
    .groupBy(organization.signupUtmSource);

  let total = 0;
  const bySource = rows.map((r) => {
    total += r.count;
    return { source: r.source ?? "direct", count: r.count };
  });
  bySource.sort((a, b) => b.count - a.count);
  return { total, bySource };
}

export async function getOverview(db: Database, params: OverviewParams): Promise<OverviewResponse> {
  const to = params.to ? new Date(params.to) : new Date();
  const from = params.from
    ? new Date(params.from)
    : new Date(to.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);

  const notes: string[] = [];

  const [mrr, trialAccounts, revenueSplit, dauMau, dunning, signups, orgCountRow] =
    await Promise.all([
      computeCurrentMrr(db, to),
      countTrialAccounts(db),
      computeRevenueSplit(db, from, to),
      getDauMau(db, to),
      listDunningSubscriptions(db),
      countNewSignupsBySource(db, from, to),
      db.select({ n: sql<number>`count(*)::int` }).from(organization),
    ]);

  // Period metrics that need point-in-time history — read from snapshots.
  const [startSnapshot, rangeSnapshots] = await Promise.all([
    getSnapshotOnOrBefore(db, from),
    getSnapshotsInRange(db, from, to),
  ]);

  // Churn = cancelled this period ÷ active at start of period.
  let churnRatePct: number | null = null;
  if (startSnapshot && startSnapshot.activeSubscriptions > 0) {
    const churned = rangeSnapshots.reduce((sum, s) => sum + s.churnedCount, 0);
    churnRatePct = (churned / startSnapshot.activeSubscriptions) * 100;
  } else {
    notes.push("Churn needs a snapshot at/before the period start; run the metrics-snapshot cron daily.");
  }

  // Trial-to-paid = conversions in period ÷ trial starts in period.
  let trialToPaidPct: number | null = null;
  const trialStarts = rangeSnapshots.reduce((sum, s) => sum + s.trialStarts, 0);
  const conversions = rangeSnapshots.reduce((sum, s) => sum + s.conversions, 0);
  if (trialStarts > 0) {
    trialToPaidPct = (conversions / trialStarts) * 100;
  } else if (rangeSnapshots.length === 0) {
    notes.push("Trial-to-paid needs snapshot history; run the metrics-snapshot cron daily.");
  }

  // LTV = ARPU × avg months retained (1 / monthly churn). Needs nonzero churn.
  let ltvCents: number | null = null;
  const arpuCents = mrr.activeSubscriptions > 0 ? mrr.mrrCents / mrr.activeSubscriptions : 0;
  if (churnRatePct !== null && churnRatePct > 0) {
    const monthsRetained = 1 / (churnRatePct / 100);
    ltvCents = Math.round(arpuCents * monthsRetained);
  } else if (churnRatePct === 0) {
    notes.push("LTV is unbounded at 0% churn — shown as unavailable rather than infinite.");
  }

  // NRR = existing-cohort MRR now ÷ MRR at period start (excludes new signups).
  let netRevenueRetentionPct: number | null = null;
  if (startSnapshot && startSnapshot.mrrCents > 0) {
    const cohortMrr = await computeCurrentMrr(db, to, from);
    netRevenueRetentionPct = (cohortMrr.mrrCents / startSnapshot.mrrCents) * 100;
  } else {
    notes.push("Net revenue retention needs a snapshot at/before the period start.");
  }

  // CAC / payback are deferred to Phase B2 (need ad-spend data from Business Numbers).
  notes.push("CAC, LTV:CAC, and payback await ad-spend data (Business Numbers tab, Phase B2).");

  const dunningStages = {
    grace: dunning.filter((d) => d.stage === "grace").length,
    locked: dunning.filter((d) => d.stage === "locked").length,
  };

  const health = evaluateHealth({
    churnRatePct,
    trialToPaidPct,
    ltvToCacRatio: null,
    paystackErroring: false,
    unresolvedFailedPayments: dunning.length,
    hasAnyTenants: (orgCountRow[0]?.n ?? 0) > 0,
  });

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    headline: {
      mrrCents: mrr.mrrCents,
      arrCents: mrr.arrCents,
      activeSubscriptions: mrr.activeSubscriptions,
      activeByTier: mrr.activeByTier,
      trialAccounts,
      churnRatePct,
      trialToPaidPct,
      newSignups: signups.total,
      newSignupsBySource: signups.bySource,
      dau: dauMau.dau,
      mau: dauMau.mau,
      dauMauRatio: dauMau.ratio,
      uniqueActiveToday: dauMau.uniqueActiveToday,
      failedPayments: dunning.length,
      dunningStages,
    },
    revenueSplit,
    unitEconomics: {
      cacCents: null,
      ltvCents,
      ltvToCacRatio: null,
      paybackMonths: null,
      netRevenueRetentionPct,
    },
    health,
    notes,
  };
}
