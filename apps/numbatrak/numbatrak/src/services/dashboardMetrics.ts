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
  offerName?: string | null;
  agentId?: number | null;
  status?: string | null;
  platform?: string | null;
  mediaBuyerName?: string | null;
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

export type LossLocationBreakdown = {
  location: string;
  label: string;
  count: number;
  wouldBeSales: number;
};

export type LossAgentBreakdown = {
  agentId: number | null;
  label: string;
  count: number;
  wouldBeSales: number;
};

export type LossProductBreakdown = {
  productId: string;
  productName: string;
  /** Total units of this product sitting in undelivered orders this period. */
  undeliveredQuantity: number;
  /** Quantity-weighted average unit price from this product's delivered
   * lines this period - 0 if it has no delivered history yet. */
  averageSalesPrice: number;
  /** undeliveredQuantity × averageSalesPrice. */
  costOfFailedOrders: number;
};

export type LossMetrics = {
  undeliveredCount: number;
  wouldBeSales: number;
  /** Estimated: ad spend × (undelivered ÷ generated) */
  allocatedAdSpend: number;
  failedDeliveryCost: number;
  byStatus: LossStatusBreakdown[];
  byLocation: LossLocationBreakdown[];
  byAgent: LossAgentBreakdown[];
  byProduct: LossProductBreakdown[];
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
  byLocation: [],
  byAgent: [],
  byProduct: [],
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
  if (scope.offerName) params.set("offerName", scope.offerName);
  if (scope.agentId != null) params.set("agentId", String(scope.agentId));
  if (scope.status) params.set("status", scope.status);
  if (scope.platform) params.set("platform", scope.platform);
  if (scope.mediaBuyerName) params.set("mediaBuyerName", scope.mediaBuyerName);
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
): Promise<{ funnelNames: string[]; subBrands: string[]; offerNames: string[]; platforms: string[]; mediaBuyerNames: string[] }> {
  if (!organizationId) {
    return { funnelNames: [], subBrands: [], offerNames: [], platforms: [], mediaBuyerNames: [] };
  }
  return apiRequest<{
    funnelNames: string[];
    subBrands: string[];
    offerNames: string[];
    platforms: string[];
    mediaBuyerNames: string[];
  }>("/org/numbatrak/dashboard/filter-options");
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

export type FunnelBreakdownRow = {
  key: string;
  mediaBuyerName: string;
  platform: string;
  offerLabel: string | null;
  orderCount: number;
  revenue: number;
  cost: number;
  profit: number;
  averageOrderValue: number;
};

/** Real orders grouped by (mediaBuyerName, platform, offer) - the "funnel"
 * combo a tracking link represents - for comparing buyers/platforms/offers
 * against each other. Doesn't accept platform/mediaBuyerName scope filters
 * since those are the dimensions being compared. */
export async function fetchFunnelBreakdown(
  organizationId: string,
  startDate?: string,
  endDate?: string,
  scope: Omit<DashboardMetricsScope, "platform" | "mediaBuyerName"> = {}
): Promise<FunnelBreakdownRow[]> {
  if (!organizationId) return [];
  const params = buildScopeParams(scope, startDate, endDate);
  const { rows } = await apiRequest<{ rows: FunnelBreakdownRow[] }>(
    `/org/numbatrak/dashboard/funnel-breakdown?${params.toString()}`
  );
  return rows;
}

/** @deprecated Use deliveryRateBand from utils/dashboardHealth */
export { deliveryRateBand } from "../utils/dashboardHealth";
