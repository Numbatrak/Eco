import { and, eq } from "drizzle-orm";
import { numbatrakCustomerOrders, type Database } from "@platform/db";
import type { DashboardScopeQuery } from "@platform/shared-types";
import { statusFilterToDbValues } from "../../numbatrak-orders/lib/order-status.js";

export interface MetricsOrderRow {
  id: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  orderRevenue: number;
  orderCost: number;
  deliveryFee: number;
  profit: number;
}

function num(v: string | null): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Server-side port of services/orderDataSource.ts's fetchMetricsOrderRows,
 * deliberately narrowed to numbatrak_customer_orders only - no
 * form_responses merge, the same scope-narrowing precedent already applied
 * in Orders/Wallet/Expenses (see those modules' own header comments). The
 * date range itself is NOT applied here - computeBusinessPerformanceMetrics/
 * computeLossMetrics bucket "generated" (by createdAt) and "delivered" (by
 * completedAt ?? createdAt) using two different anchors, so date filtering
 * happens inside those pure functions, not in this row fetch.
 */
export async function fetchOrderRows(
  db: Database,
  organizationId: string,
  scope: Pick<DashboardScopeQuery, "formId" | "csrId" | "funnelName" | "subBrand" | "agentId" | "status">,
): Promise<MetricsOrderRow[]> {
  const conditions = [eq(numbatrakCustomerOrders.organizationId, organizationId)];
  if (scope.formId) conditions.push(eq(numbatrakCustomerOrders.formId, scope.formId));
  if (scope.csrId) conditions.push(eq(numbatrakCustomerOrders.csrId, scope.csrId));
  if (scope.funnelName) conditions.push(eq(numbatrakCustomerOrders.funnelName, scope.funnelName));
  if (scope.subBrand) conditions.push(eq(numbatrakCustomerOrders.subBrand, scope.subBrand));
  if (scope.agentId != null) conditions.push(eq(numbatrakCustomerOrders.agentId, scope.agentId));

  const rows = await db
    .select({
      id: numbatrakCustomerOrders.id,
      status: numbatrakCustomerOrders.status,
      createdAt: numbatrakCustomerOrders.createdAt,
      completedAt: numbatrakCustomerOrders.completedAt,
      orderRevenue: numbatrakCustomerOrders.orderRevenue,
      orderCost: numbatrakCustomerOrders.orderCost,
      deliveryFee: numbatrakCustomerOrders.deliveryFee,
      profit: numbatrakCustomerOrders.profit,
    })
    .from(numbatrakCustomerOrders)
    .where(and(...conditions));

  const mapped: MetricsOrderRow[] = rows.map((r) => ({
    id: r.id,
    status: r.status,
    createdAt: r.createdAt?.toISOString() ?? new Date().toISOString(),
    completedAt: r.completedAt?.toISOString() ?? null,
    orderRevenue: num(r.orderRevenue),
    orderCost: num(r.orderCost),
    deliveryFee: num(r.deliveryFee),
    profit: num(r.profit),
  }));

  if (!scope.status) return mapped;
  const dbValues = new Set(statusFilterToDbValues(scope.status));
  return mapped.filter((r) => dbValues.has(r.status));
}
