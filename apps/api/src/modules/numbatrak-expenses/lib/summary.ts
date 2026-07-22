import { and, eq } from "drizzle-orm";
import { numbatrakCustomerOrders, numbatrakUnifiedExpenses, type Database } from "@platform/db";
import type { ExpenseSummaryQuery, NumbatrakExpenseSummary } from "@platform/shared-types";
import { isAdvertisingCategory, normalizeOrgExpenseCategory } from "./category-normalization.js";

function withinRange(date: Date, startDate?: string, endDate?: string): boolean {
  if (startDate && date < new Date(startDate)) return false;
  if (endDate && date > new Date(endDate)) return false;
  return true;
}

/**
 * Server-side port of services/expenseSummary.ts's fetchExpenseSummary +
 * computeExpenseSummary + fetchDeliveredRevenue, combined into one endpoint.
 * fetchDeliveredRevenue's source (services/orderDataSource.ts) is dead code
 * from the skipped v1/v2 merge (see numbatrak-orders port notes) - this
 * queries numbatrak_customer_orders directly instead. Preserves the exact
 * (slightly narrow) source filter: status === "completed" only, not the
 * broader isDeliveredStatus ("delivered" OR "completed") - changing that
 * would silently move revenue/ROAS numbers.
 */
export async function computeExpenseSummary(
  db: Database,
  organizationId: string,
  query: ExpenseSummaryQuery,
): Promise<NumbatrakExpenseSummary> {
  const expenseRows = await db
    .select({
      scope: numbatrakUnifiedExpenses.scope,
      category: numbatrakUnifiedExpenses.category,
      amount: numbatrakUnifiedExpenses.amount,
      occurredAt: numbatrakUnifiedExpenses.occurredAt,
    })
    .from(numbatrakUnifiedExpenses)
    .where(eq(numbatrakUnifiedExpenses.organizationId, organizationId));

  const byCategory = { operational: 0, building: 0, marketing: 0, advertising: 0, agent: 0 };
  let totalOrgExpenses = 0;
  let totalAgentExpenses = 0;
  let advertisingSpend = 0;

  for (const row of expenseRows) {
    if (!withinRange(new Date(row.occurredAt), query.dateFrom, query.dateTo)) continue;
    const amount = Number(row.amount) || 0;

    if (row.scope === "agent") {
      byCategory.agent += amount;
      totalAgentExpenses += amount;
      continue;
    }

    const cat = normalizeOrgExpenseCategory(row.category);
    byCategory[cat] += amount;
    totalOrgExpenses += amount;
    if (isAdvertisingCategory(cat)) advertisingSpend += amount;
  }

  const orderRows = await db
    .select({
      status: numbatrakCustomerOrders.status,
      orderRevenue: numbatrakCustomerOrders.orderRevenue,
      completedAt: numbatrakCustomerOrders.completedAt,
      createdAt: numbatrakCustomerOrders.createdAt,
    })
    .from(numbatrakCustomerOrders)
    .where(and(eq(numbatrakCustomerOrders.organizationId, organizationId), eq(numbatrakCustomerOrders.status, "completed")));

  let deliveredRevenue = 0;
  for (const row of orderRows) {
    const anchor = row.completedAt ?? row.createdAt;
    if (!anchor || !withinRange(anchor, query.dateFrom, query.dateTo)) continue;
    deliveredRevenue += Number(row.orderRevenue) || 0;
  }

  const totalExpenses = totalOrgExpenses + totalAgentExpenses;
  const nonAdvertisingOrgExpenses = totalOrgExpenses - advertisingSpend;
  const expensePercentOfRevenue = deliveredRevenue > 0 ? (totalExpenses / deliveredRevenue) * 100 : 0;
  const advertisingRoas = advertisingSpend > 0 ? deliveredRevenue / advertisingSpend : 0;

  return {
    byCategory,
    totalOrgExpenses,
    totalAgentExpenses,
    totalExpenses,
    advertisingSpend,
    nonAdvertisingOrgExpenses,
    deliveredRevenue,
    expensePercentOfRevenue,
    advertisingRoas,
  };
}
