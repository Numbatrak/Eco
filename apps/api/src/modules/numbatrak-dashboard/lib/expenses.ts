import { and, eq } from "drizzle-orm";
import { numbatrakUnifiedExpenses, type Database } from "@platform/db";
import { isAdvertisingCategory } from "../../numbatrak-expenses/lib/category-normalization.js";

function num(v: string | null): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function withinRange(dateStr: string, startDate?: string, endDate?: string): boolean {
  if (startDate && dateStr < startDate) return false;
  if (endDate && dateStr > endDate) return false;
  return true;
}

/**
 * Server-side port of dashboardMetrics.ts's fetchExpenseTotals. No scope
 * filter (matches source exactly - every row, org- and agent-scope alike,
 * gets bucketed by isAdvertisingCategory). Agent-scope rows are always
 * category='operational' per the DB check constraint, so they always land
 * in totalNonAdExpenses - same as the source app, no adjustment needed
 * (unlike reusing the Expenses module's own summary endpoint, which
 * deliberately excludes agent-scope from its "org expenses" bucket - this
 * is a fresh read, not a reuse, so that trap doesn't apply here).
 */
export async function fetchExpenseTotals(
  db: Database,
  organizationId: string,
  startDate?: string,
  endDate?: string,
): Promise<{ adSpend: number; totalNonAdExpenses: number }> {
  const rows = await db
    .select({ amount: numbatrakUnifiedExpenses.amount, occurredAt: numbatrakUnifiedExpenses.occurredAt, category: numbatrakUnifiedExpenses.category })
    .from(numbatrakUnifiedExpenses)
    .where(eq(numbatrakUnifiedExpenses.organizationId, organizationId));

  let adSpend = 0;
  let totalNonAdExpenses = 0;
  for (const row of rows) {
    if (!withinRange(row.occurredAt, startDate, endDate)) continue;
    const amount = num(row.amount);
    if (isAdvertisingCategory(row.category)) {
      adSpend += amount;
    } else {
      totalNonAdExpenses += amount;
    }
  }
  return { adSpend, totalNonAdExpenses };
}

export async function fetchFailedDeliveryCost(
  db: Database,
  organizationId: string,
  startDate?: string,
  endDate?: string,
): Promise<number> {
  const rows = await db
    .select({ amount: numbatrakUnifiedExpenses.amount, occurredAt: numbatrakUnifiedExpenses.occurredAt })
    .from(numbatrakUnifiedExpenses)
    .where(and(eq(numbatrakUnifiedExpenses.organizationId, organizationId), eq(numbatrakUnifiedExpenses.subcategory, "failed_delivery")));

  let total = 0;
  for (const row of rows) {
    if (!withinRange(row.occurredAt, startDate, endDate)) continue;
    total += num(row.amount);
  }
  return total;
}
