"use client";

import { supabase } from "../supabaseClient";
import {
  isDeliveredStatus,
  statusFilterToDbValues,
  orderStatusLabel,
} from "../constants/orderStatus";
import { withinDateRange } from "./dashboardProjection";
import { fetchMetricsOrderRows, type OrderScopeFilters } from "./orderDataSource";
import { isAdvertisingCategory } from "../utils/expenseCategoryHelpers";

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

function num(v: number | string | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isGeneratedOrder(row: MetricsOrderRow): boolean {
  return row.status !== "cancelled";
}

function isDeliveredOrder(row: MetricsOrderRow): boolean {
  return isDeliveredStatus(row.status);
}

function inGeneratedPeriod(
  row: MetricsOrderRow,
  startDate?: string,
  endDate?: string
): boolean {
  return withinDateRange(row.created_at, startDate, endDate);
}

function inDeliveredPeriod(
  row: MetricsOrderRow,
  startDate?: string,
  endDate?: string
): boolean {
  const anchor = row.completed_at || row.created_at;
  return withinDateRange(anchor, startDate, endDate);
}

function scopeToOrderFilters(scope: DashboardMetricsScope): OrderScopeFilters {
  return {
    formId: scope.formId,
    csrId: scope.csrId,
    funnelName: scope.funnelName,
    subBrand: scope.subBrand,
    agentId: scope.agentId,
  };
}

/** Client-side status filter (supports legacy alias groups). */
export function filterOrdersByStatus<T extends { status: string }>(
  orders: T[],
  status?: string | null
): T[] {
  if (!status) return orders;
  const dbValues = statusFilterToDbValues(status);
  return orders.filter((o) => dbValues.includes(o.status));
}

export function computeBusinessPerformanceMetrics(input: {
  orders: MetricsOrderRow[];
  adSpend: number;
  totalNonAdExpenses: number;
  startDate?: string;
  endDate?: string;
}): BusinessPerformanceMetrics {
  const { orders, adSpend, totalNonAdExpenses, startDate, endDate } = input;

  const generated = orders.filter(
    (o) => isGeneratedOrder(o) && inGeneratedPeriod(o, startDate, endDate)
  );
  const delivered = orders.filter(
    (o) => isDeliveredOrder(o) && inDeliveredPeriod(o, startDate, endDate)
  );

  const totalOrdersGenerated = generated.length;
  const totalOrdersDelivered = delivered.length;

  const deliveryRate =
    totalOrdersGenerated > 0
      ? (totalOrdersDelivered / totalOrdersGenerated) * 100
      : 0;

  const totalDeliveredSales = delivered.reduce(
    (s, o) => s + num(o.order_revenue),
    0
  );
  const totalCogs = delivered.reduce((s, o) => s + num(o.order_cost), 0);
  const totalDeliveryFees = delivered.reduce(
    (s, o) => s + num(o.delivery_fee),
    0
  );

  const averageOrderValue =
    totalOrdersDelivered > 0 ? totalDeliveredSales / totalOrdersDelivered : 0;
  const averageCogs =
    totalOrdersDelivered > 0 ? totalCogs / totalOrdersDelivered : 0;
  const averageDeliveryFee =
    totalOrdersDelivered > 0 ? totalDeliveryFees / totalOrdersDelivered : 0;

  const platformCpa =
    totalOrdersGenerated > 0 && adSpend > 0 ? adSpend / totalOrdersGenerated : 0;
  const realCpa =
    totalOrdersDelivered > 0 && adSpend > 0 ? adSpend / totalOrdersDelivered : 0;
  const cpaGap = realCpa - platformCpa;

  const profitPerOrder =
    averageOrderValue - realCpa - averageCogs - averageDeliveryFee;
  const totalProfit = profitPerOrder * totalOrdersDelivered;

  const roas = adSpend > 0 ? totalDeliveredSales / adSpend : 0;

  const totalInvestment = adSpend + totalNonAdExpenses;
  const netProfitAfterAllExpenses =
    totalDeliveredSales - totalCogs - totalDeliveryFees - totalInvestment;
  const businessRoi =
    totalInvestment > 0 ? netProfitAfterAllExpenses / totalInvestment : 0;

  return {
    totalOrdersGenerated,
    totalOrdersDelivered,
    deliveryRate,
    totalDeliveredSales,
    averageOrderValue,
    adSpend,
    platformCpa,
    realCpa,
    cpaGap,
    totalCogs,
    averageCogs,
    totalDeliveryFees,
    averageDeliveryFee,
    profitPerOrder,
    totalProfit,
    roas,
    businessRoi,
    totalNonAdExpenses,
    totalInvestment,
    netProfitAfterAllExpenses,
  };
}

export function computeLossMetrics(input: {
  orders: MetricsOrderRow[];
  adSpend: number;
  failedDeliveryCost: number;
  startDate?: string;
  endDate?: string;
}): LossMetrics {
  const { orders, adSpend, failedDeliveryCost, startDate, endDate } = input;

  const generated = orders.filter(
    (o) => isGeneratedOrder(o) && inGeneratedPeriod(o, startDate, endDate)
  );
  const undelivered = generated.filter((o) => !isDeliveredOrder(o));

  const undeliveredCount = undelivered.length;
  const wouldBeSales = undelivered.reduce((s, o) => s + num(o.order_revenue), 0);
  const allocatedAdSpend =
    generated.length > 0 && adSpend > 0
      ? adSpend * (undeliveredCount / generated.length)
      : 0;

  const statusMap = new Map<string, LossStatusBreakdown>();
  for (const row of undelivered) {
    const status = row.status || "unknown";
    const existing = statusMap.get(status);
    const revenue = num(row.order_revenue);
    if (existing) {
      existing.count += 1;
      existing.wouldBeSales += revenue;
    } else {
      statusMap.set(status, {
        status,
        label: orderStatusLabel(status),
        count: 1,
        wouldBeSales: revenue,
      });
    }
  }

  const byStatus = [...statusMap.values()].sort((a, b) => b.count - a.count);

  return {
    undeliveredCount,
    wouldBeSales,
    allocatedAdSpend,
    failedDeliveryCost,
    byStatus,
  };
}

async function fetchOrderRows(
  organizationId: string,
  scope: DashboardMetricsScope
): Promise<MetricsOrderRow[]> {
  const orderScope = scopeToOrderFilters(scope);
  const rows = await fetchMetricsOrderRows(
    organizationId,
    scope.formId,
    scope.csrId,
    orderScope
  );
  return filterOrdersByStatus(rows, scope.status);
}

async function fetchExpenseTotals(
  organizationId: string,
  startDate?: string,
  endDate?: string
): Promise<{ adSpend: number; totalNonAdExpenses: number }> {
  const { data, error } = await supabase
    .from("unified_expenses")
    .select("amount, occurred_at, category")
    .eq("organization_id", organizationId);

  if (error) {
    console.warn("dashboardMetrics: unified_expenses", error);
    return { adSpend: 0, totalNonAdExpenses: 0 };
  }

  let adSpend = 0;
  let totalNonAdExpenses = 0;

  for (const row of data || []) {
    const t = row.occurred_at as string;
    if (startDate && t < startDate) continue;
    if (endDate && t > endDate) continue;

    const amount = num(row.amount);
    if (isAdvertisingCategory(row.category)) {
      adSpend += amount;
    } else {
      totalNonAdExpenses += amount;
    }
  }

  return { adSpend, totalNonAdExpenses };
}

async function fetchFailedDeliveryCost(
  organizationId: string,
  startDate?: string,
  endDate?: string
): Promise<number> {
  const { data, error } = await supabase
    .from("unified_expenses")
    .select("amount, occurred_at, subcategory")
    .eq("organization_id", organizationId)
    .eq("subcategory", "failed_delivery");

  if (error) {
    console.warn("dashboardMetrics: failed_delivery expenses", error);
    return 0;
  }

  let total = 0;
  for (const row of data || []) {
    const t = row.occurred_at as string;
    if (startDate && t < startDate) continue;
    if (endDate && t > endDate) continue;
    total += num(row.amount);
  }
  return total;
}

export async function fetchDashboardFilterOptions(
  organizationId: string
): Promise<{ funnelNames: string[]; subBrands: string[] }> {
  if (!organizationId) {
    return { funnelNames: [], subBrands: [] };
  }

  const { data, error } = await supabase
    .from("customer_orders")
    .select("funnel_name, sub_brand")
    .eq("organization_id", organizationId);

  if (error) {
    console.warn("dashboardMetrics: filter options", error);
    return { funnelNames: [], subBrands: [] };
  }

  const funnelSet = new Set<string>();
  const subBrandSet = new Set<string>();
  for (const row of data || []) {
    const funnel = (row as { funnel_name?: string }).funnel_name?.trim();
    const subBrand = (row as { sub_brand?: string }).sub_brand?.trim();
    if (funnel) funnelSet.add(funnel);
    if (subBrand) subBrandSet.add(subBrand);
  }

  return {
    funnelNames: [...funnelSet].sort(),
    subBrands: [...subBrandSet].sort(),
  };
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

  const [orders, expenses] = await Promise.all([
    fetchOrderRows(organizationId, scope),
    fetchExpenseTotals(organizationId, startDate, endDate),
  ]);

  return computeBusinessPerformanceMetrics({
    orders,
    adSpend: expenses.adSpend,
    totalNonAdExpenses: expenses.totalNonAdExpenses,
    startDate,
    endDate,
  });
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

  const [orders, expenses, failedDeliveryCost] = await Promise.all([
    fetchOrderRows(organizationId, scope),
    fetchExpenseTotals(organizationId, startDate, endDate),
    fetchFailedDeliveryCost(organizationId, startDate, endDate),
  ]);

  return computeLossMetrics({
    orders,
    adSpend: expenses.adSpend,
    failedDeliveryCost,
    startDate,
    endDate,
  });
}

/** @deprecated Use deliveryRateBand from utils/dashboardHealth */
export { deliveryRateBand } from "../utils/dashboardHealth";
