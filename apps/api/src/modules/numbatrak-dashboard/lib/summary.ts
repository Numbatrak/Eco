import { inArray } from "drizzle-orm";
import { numbatrakAgents, type Database } from "@platform/db";
import type { DashboardScopeQuery, NumbatrakDashboardSummary } from "@platform/shared-types";
import { fetchOrderRows } from "./order-rows.js";
import { fetchExpenseTotals, fetchFailedDeliveryCost } from "./expenses.js";
import { computeBusinessPerformanceMetrics, computeLossMetrics } from "./metrics.js";

export async function fetchDashboardSummary(
  db: Database,
  organizationId: string,
  scope: DashboardScopeQuery,
): Promise<NumbatrakDashboardSummary> {
  const [orders, expenses, failedDeliveryCost] = await Promise.all([
    fetchOrderRows(db, organizationId, scope),
    fetchExpenseTotals(db, organizationId, scope.dateFrom, scope.dateTo),
    fetchFailedDeliveryCost(db, organizationId, scope.dateFrom, scope.dateTo),
  ]);

  // Loss-metrics' byLocation/byAgent breakdowns need each order's agent's
  // name + declared location - same lookup pattern as attachRelations
  // (numbatrak-orders/lib/orders.ts) and delivery-rate.ts's
  // primaryLocationByAgent, just scoped to the agentIds actually present here.
  const agentIds = [...new Set(orders.map((o) => o.agentId).filter((id): id is number => id != null))];
  const agents =
    agentIds.length > 0
      ? await db
          .select({ id: numbatrakAgents.id, name: numbatrakAgents.name, locations: numbatrakAgents.locations })
          .from(numbatrakAgents)
          .where(inArray(numbatrakAgents.id, agentIds))
      : [];

  const businessMetrics = computeBusinessPerformanceMetrics({
    orders,
    adSpend: expenses.adSpend,
    totalNonAdExpenses: expenses.totalNonAdExpenses,
    startDate: scope.dateFrom,
    endDate: scope.dateTo,
  });

  const lossMetrics = computeLossMetrics({
    orders,
    adSpend: expenses.adSpend,
    failedDeliveryCost,
    startDate: scope.dateFrom,
    endDate: scope.dateTo,
    agents,
  });

  return { businessMetrics, lossMetrics };
}
