import type { Database } from "@platform/db";
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
  });

  return { businessMetrics, lossMetrics };
}
