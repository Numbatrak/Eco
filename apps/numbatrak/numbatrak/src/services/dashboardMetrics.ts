"use client";

import { apiRequest } from "../lib/apiClient";
import { statusFilterToDbValues, orderStatusLabel } from "../constants/orderStatus";

/** Order row fields used for business-performance metrics. */
export type MetricsOrderRow = {
  id: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  order_revenue: number | string | null;
  order_cost: number | string | null;
  delivery_fee: number | string | null;
  profit: number | string | null;
  agent_id?: number | null;
  funnel_name?: string | null;
  sub_brand?: string | null;
};

export type DashboardMetricsScope = {
  formId?: string | null;
  csrId?: string | null;
  funnelName?: string | null;
  subBrand?: string | null;
  agentId?: number | null;
  status?: string | null;
};

export type BusinessPerformanceMetrics = {
  totalOrdersGenerated: number;
  totalOrdersDelivered: number;
  deliveryRate: number;
  /** Total sales value of delivered orders */
  totalDeliveredSales: number;
  averageOrderValue: number;
  adSpend: number;
  platformCpa: number;
  realCpa: number;
  cpaGap: number;
  totalCogs: number;
  averageCogs: number;
  totalDeliveryFees: number;
  averageDeliveryFee: number;
  profitPerOrder: number;
  totalProfit: number;
  /** Return on ad spend — delivered revenue ÷ ad spend */
  roas: number;
  /** Net profit after all expenses ÷ total investment (ad + non-ad expenses) */
  businessRoi: number;
  totalNonAdExpenses: number;
  totalInvestment: number;
  netProfitAfterAllExpenses: number;
};

export type LossStatusBreakdown = {
  status: string;
  label: string;
  count: number;
  wouldBeSales: number;
};

export type LossMetrics = {
  undeliveredCount: number;
  wouldBeSales: number;
  /** Estimated: ad spend × (undelivered ÷ generated) */
  allocatedAdSpend: number;
  failedDeliveryCost: number;
  byStatus: LossStatusBreakdown[];
};

export const EMPTY_BUSINESS_METRICS: BusinessPerformanceMetrics = {
  totalOrdersGenerated: 0,
  totalOrdersDelivered: 0,
  deliveryRate: 0,
  totalDeliveredSales: 0,
  averageOrderValue: 0,
  adSpend: 0,
  platformCpa: 0,
  realCpa: 0,
  cpaGap: 0,
  totalCogs: 0,
  averageCogs: 0,
  totalDeliveryFees: 0,
  averageDeliveryFee: 0,
  profitPerOrder: 0,
  totalProfit: 0,
  roas: 0,
  businessRoi: 0,
  totalNonAdExpenses: 0,
  totalInvestment: 0,
  netProfitAfterAllExpenses: 0,
};

export const EMPTY_LOSS_METRICS: LossMetrics = {
  undeliveredCount: 0,
  wouldBeSales: 0,
  allocatedAdSpend: 0,
  failedDeliveryCost: 0,
  byStatus: [],
};

/** Client-side status filter (supports legacy alias groups). */
export function filterOrdersByStatus<T extends { status: string }>(
  orders: T[],
  status?: string | null
): T[] {
  if (!status) return orders;
  const dbValues = statusFilterToDbValues(status);
  return orders.filter((o) => dbValues.includes(o.status));
}

interface SummaryDto {
  businessMetrics: BusinessPerformanceMetrics;
  lossMetrics: Omit<LossMetrics, "byStatus"> & { byStatus: Array<{ status: string; count: number; wouldBeSales: number }> };
}

function buildScopeParams(scope: DashboardMetricsScope, dateFrom?: string, dateTo?: string): URLSearchParams {
  const params = new URLSearchParams();
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  if (scope.formId) params.set("formId", scope.formId);
  if (scope.csrId) params.set("csrId", scope.csrId);
  if (scope.funnelName) params.set("funnelName", scope.funnelName);
  if (scope.subBrand) params.set("subBrand", scope.subBrand);
  if (scope.agentId != null) params.set("agentId", String(scope.agentId));
  if (scope.status) params.set("status", scope.status);
  return params;
}

async function fetchSummary(
  _organizationId: string,
  startDate: string | undefined,
  endDate: string | undefined,
  scope: DashboardMetricsScope
): Promise<SummaryDto> {
  const params = buildScopeParams(scope, startDate, endDate);
  return apiRequest<SummaryDto>(`/org/numbatrak/dashboard/summary?${params.toString()}`);
}

export async function fetchDashboardFilterOptions(
  organizationId: string
): Promise<{ funnelNames: string[]; subBrands: string[] }> {
  if (!organizationId) {
    return { funnelNames: [], subBrands: [] };
  }
  return apiRequest<{ funnelNames: string[]; subBrands: string[] }>("/org/numbatrak/dashboard/filter-options");
}

export async function fetchBusinessPerformanceMetrics(
  organizationId: string,
  startDate?: string,
  endDate?: string,
  scope: DashboardMetricsScope = {}
): Promise<BusinessPerformanceMetrics> {
  if (!organizationId) {
    return EMPTY_BUSINESS_METRICS;
  }
  const { businessMetrics } = await fetchSummary(organizationId, startDate, endDate, scope);
  return businessMetrics;
}

export async function fetchLossMetrics(
  organizationId: string,
  startDate?: string,
  endDate?: string,
  scope: DashboardMetricsScope = {}
): Promise<LossMetrics> {
  if (!organizationId) {
    return EMPTY_LOSS_METRICS;
  }
  const { lossMetrics } = await fetchSummary(organizationId, startDate, endDate, scope);
  return {
    ...lossMetrics,
    byStatus: lossMetrics.byStatus.map((s) => ({ ...s, label: orderStatusLabel(s.status) })),
  };
}

/** @deprecated Use deliveryRateBand from utils/dashboardHealth */
export { deliveryRateBand } from "../utils/dashboardHealth";
