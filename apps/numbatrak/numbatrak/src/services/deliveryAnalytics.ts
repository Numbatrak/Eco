"use client";

import { apiRequest } from "../lib/apiClient";
import { DateFilter, resolveDateRange } from "../utils/dateRange";
import type { DeliveryRateByLocation } from "./dashboard";

export type DeliveryLogisticsStatus = "Waybilled" | "Delivered";
export type DeliveryLocationFilter = "all" | "lagos" | "outside_lagos";

export type DeliveryAnalyticsFilters = {
  dateFilter?: DateFilter;
  agentId?: number | null;
  productId?: string | null;
  status?: DeliveryLogisticsStatus | "all";
  subBrand?: string | null;
  location?: DeliveryLocationFilter;
};

export type DeliveryAnalyticsHeadline = {
  waybilledValue: number;
  deliveredValue: number;
  balance: number;
  deliveryRate: number;
  waybilledCount: number;
  deliveredCount: number;
};

export type DeliveryBreakdownRow = {
  key: string;
  label: string;
  waybilledValue: number;
  deliveredValue: number;
  balance: number;
  deliveryRate: number;
  waybilledCount: number;
  deliveredCount: number;
};

const EMPTY_HEADLINE: DeliveryAnalyticsHeadline = {
  waybilledValue: 0,
  deliveredValue: 0,
  balance: 0,
  deliveryRate: 0,
  waybilledCount: 0,
  deliveredCount: 0,
};

function filtersToParams(filters?: DeliveryAnalyticsFilters): URLSearchParams {
  const params = new URLSearchParams();
  const { startDate, endDate } = resolveDateRange(filters?.dateFilter);
  if (startDate) params.set("dateFrom", startDate);
  if (endDate) params.set("dateTo", endDate);
  if (filters?.agentId != null) params.set("agentId", String(filters.agentId));
  if (filters?.productId) params.set("productId", filters.productId);
  if (filters?.status && filters.status !== "all") params.set("status", filters.status);
  if (filters?.subBrand) params.set("subBrand", filters.subBrand);
  if (filters?.location && filters.location !== "all") params.set("location", filters.location);
  return params;
}

export async function fetchDeliveryAnalyticsHeadline(
  organizationId: string | null,
  filters?: DeliveryAnalyticsFilters
): Promise<DeliveryAnalyticsHeadline> {
  if (!organizationId) return EMPTY_HEADLINE;
  return apiRequest<DeliveryAnalyticsHeadline>(
    `/org/numbatrak/dashboard/delivery-analytics-headline?${filtersToParams(filters).toString()}`
  );
}

export async function fetchDeliveryRateByLocationFiltered(
  organizationId: string | null,
  filters?: DeliveryAnalyticsFilters
): Promise<DeliveryRateByLocation[]> {
  if (!organizationId) {
    return [
      { location: "Overall", totalDeliveries: 0, deliveredCount: 0, waybilledCount: 0, deliveryRate: 0 },
    ];
  }
  // Location filtering is meaningless for this endpoint (it computes its own
  // per-agent-location breakdown) - drop it before building params.
  const params = filtersToParams({ ...filters, location: "all" });
  const { rates } = await apiRequest<{ rates: DeliveryRateByLocation[] }>(
    `/org/numbatrak/dashboard/delivery-rate-by-location?${params.toString()}`
  );
  return rates;
}

async function fetchDeliveryBreakdown(
  organizationId: string | null,
  groupBy: "agent" | "product" | "location",
  filters?: DeliveryAnalyticsFilters
): Promise<DeliveryBreakdownRow[]> {
  if (!organizationId) return [];
  const params = filtersToParams(filters);
  params.set("groupBy", groupBy);
  const { rows } = await apiRequest<{ rows: DeliveryBreakdownRow[] }>(
    `/org/numbatrak/dashboard/delivery-breakdown?${params.toString()}`
  );
  return rows;
}

export async function fetchDeliveryBreakdownByAgent(
  organizationId: string | null,
  filters?: DeliveryAnalyticsFilters
): Promise<DeliveryBreakdownRow[]> {
  return fetchDeliveryBreakdown(organizationId, "agent", filters);
}

export async function fetchDeliveryBreakdownByProduct(
  organizationId: string | null,
  filters?: DeliveryAnalyticsFilters
): Promise<DeliveryBreakdownRow[]> {
  return fetchDeliveryBreakdown(organizationId, "product", filters);
}

export async function fetchDeliveryBreakdownByLocation(
  organizationId: string | null,
  filters?: DeliveryAnalyticsFilters
): Promise<DeliveryBreakdownRow[]> {
  return fetchDeliveryBreakdown(organizationId, "location", filters);
}

export function toMonthlySummaryQueryOptions(
  filters: DeliveryAnalyticsFilters
): import("./deliveries").MonthlySummaryQueryOptions {
  return {
    agentId: filters.agentId ?? undefined,
    productId: filters.productId ?? undefined,
    status: filters.status && filters.status !== "all" ? filters.status : undefined,
    subBrand: filters.subBrand ?? undefined,
    location: filters.location ?? "all",
  };
}
