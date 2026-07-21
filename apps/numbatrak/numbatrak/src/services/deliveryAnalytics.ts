"use client";

import { supabase } from "../supabaseClient";
import { DateFilter, resolveDateRange, withinDateRange } from "../utils/dateRange";
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

type DeliveryRow = {
  id: number;
  date: string;
  status: string;
  cost: number;
  waybilling_fee: number;
  agent_id: number | null;
  product_id: string;
  sub_brand: string | null;
};

const EMPTY_HEADLINE: DeliveryAnalyticsHeadline = {
  waybilledValue: 0,
  deliveredValue: 0,
  balance: 0,
  deliveryRate: 0,
  waybilledCount: 0,
  deliveredCount: 0,
};

/** @deprecated Use DeliveryAnalyticsHeadline */
export interface DeliveryAnalyticsOverview {
  totalWaybills: number;
  waybillProductCost: number;
  totalDeliveriesDone: number;
  deliveriesOutsideLagos: number;
  valueOfGoodsOutside: number;
}

export const EMPTY_DELIVERY_ANALYTICS_OVERVIEW: DeliveryAnalyticsOverview = {
  totalWaybills: 0,
  waybillProductCost: 0,
  totalDeliveriesDone: 0,
  deliveriesOutsideLagos: 0,
  valueOfGoodsOutside: 0,
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseAgentLocations(locations: unknown): string[] {
  if (typeof locations === "string") {
    return locations
      .split(",")
      .map((loc) => loc.trim())
      .filter(Boolean);
  }
  if (Array.isArray(locations)) {
    return locations.map((loc) => String(loc).trim()).filter(Boolean);
  }
  return [];
}

function isLagosAgent(locations: unknown): boolean {
  return parseAgentLocations(locations).some(
    (loc) => loc.toLowerCase() === "lagos"
  );
}

function computeDeliveryRate(deliveredCount: number, totalCount: number): number {
  if (totalCount <= 0) return 0;
  return Number(((deliveredCount / totalCount) * 100).toFixed(1));
}

function accumulateHeadline(
  rows: DeliveryRow[]
): Omit<DeliveryAnalyticsHeadline, "deliveryRate"> {
  let waybilledValue = 0;
  let deliveredValue = 0;
  let waybilledCount = 0;
  let deliveredCount = 0;

  for (const row of rows) {
    const cost = num(row.cost);
    if (row.status === "Waybilled") {
      waybilledValue += cost;
      waybilledCount += 1;
    } else if (row.status === "Delivered") {
      deliveredValue += cost;
      deliveredCount += 1;
    }
  }

  return {
    waybilledValue,
    deliveredValue,
    balance: waybilledValue - deliveredValue,
    waybilledCount,
    deliveredCount,
  };
}

async function fetchAgentsMap(organizationId: string, agentIds: number[]) {
  const map = new Map<number, { name: string; locations: unknown }>();
  if (!agentIds.length) return map;

  const { data } = await supabase
    .from("agents")
    .select("id, name, locations")
    .eq("organization_id", organizationId)
    .in("id", agentIds);

  for (const row of data || []) {
    map.set(Number((row as { id: number }).id), {
      name: String((row as { name: string }).name),
      locations: (row as { locations: unknown }).locations,
    });
  }
  return map;
}

async function fetchProductsMap(organizationId: string, productIds: string[]) {
  const map = new Map<string, string>();
  if (!productIds.length) return map;

  const { data } = await supabase
    .from("products")
    .select("id, name")
    .eq("organization_id", organizationId)
    .in("id", productIds);

  for (const row of data || []) {
    map.set(String((row as { id: string }).id), String((row as { name: string }).name));
  }
  return map;
}

export async function fetchFilteredDeliveryRows(
  organizationId: string | null,
  filters?: DeliveryAnalyticsFilters
): Promise<DeliveryRow[]> {
  if (!organizationId) return [];

  let query = supabase
    .from("deliveries")
    .select(
      "id, date, status, cost, waybilling_fee, agent_id, product_id, sub_brand"
    )
    .eq("organization_id", organizationId);

  if (filters?.agentId != null) {
    query = query.eq("agent_id", filters.agentId);
  }
  if (filters?.productId) {
    query = query.eq("product_id", filters.productId);
  }
  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters?.subBrand) {
    query = query.eq("sub_brand", filters.subBrand);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data || []).map((row) => ({
    id: Number((row as DeliveryRow).id),
    date: String((row as DeliveryRow).date),
    status: String((row as DeliveryRow).status),
    cost: num((row as DeliveryRow).cost),
    waybilling_fee: num((row as DeliveryRow).waybilling_fee),
    agent_id:
      (row as DeliveryRow).agent_id != null
        ? Number((row as DeliveryRow).agent_id)
        : null,
    product_id: String((row as DeliveryRow).product_id),
    sub_brand: (row as DeliveryRow).sub_brand ?? null,
  }));

  const { startDate, endDate } = resolveDateRange(filters?.dateFilter);
  let filtered = rows.filter((row) =>
    withinDateRange(row.date, startDate, endDate)
  );

  const location = filters?.location ?? "all";
  if (location !== "all") {
    const agentIds = [
      ...new Set(filtered.map((r) => r.agent_id).filter(Boolean)),
    ] as number[];
    const agentsMap = await fetchAgentsMap(organizationId, agentIds);
    filtered = filtered.filter((row) => {
      if (row.agent_id == null) return false;
      const agent = agentsMap.get(row.agent_id);
      if (!agent) return false;
      const lagos = isLagosAgent(agent.locations);
      return location === "lagos" ? lagos : !lagos;
    });
  }

  return filtered;
}

export async function fetchDeliveryAnalyticsHeadline(
  organizationId: string | null,
  filters?: DeliveryAnalyticsFilters
): Promise<DeliveryAnalyticsHeadline> {
  const rows = await fetchFilteredDeliveryRows(organizationId, filters);
  if (!rows.length) return EMPTY_HEADLINE;

  const totals = accumulateHeadline(rows);
  return {
    ...totals,
    deliveryRate: computeDeliveryRate(
      totals.deliveredCount,
      totals.waybilledCount + totals.deliveredCount
    ),
  };
}

export async function fetchDeliveryRateByLocationFiltered(
  organizationId: string | null,
  filters?: DeliveryAnalyticsFilters
): Promise<DeliveryRateByLocation[]> {
  if (!organizationId) {
    return [
      { location: "Overall", totalDeliveries: 0, deliveredCount: 0, waybilledCount: 0, deliveryRate: 0 },
      { location: "Lagos", totalDeliveries: 0, deliveredCount: 0, waybilledCount: 0, deliveryRate: 0 },
      { location: "Outside Lagos", totalDeliveries: 0, deliveredCount: 0, waybilledCount: 0, deliveryRate: 0 },
    ];
  }

  const baseFilters: DeliveryAnalyticsFilters = {
    ...filters,
    location: "all",
  };
  const rows = await fetchFilteredDeliveryRows(organizationId, baseFilters);
  const agentIds = [
    ...new Set(rows.map((r) => r.agent_id).filter(Boolean)),
  ] as number[];
  const agentsMap = await fetchAgentsMap(organizationId, agentIds);

  const lagosStats = { totalDeliveries: 0, deliveredCount: 0, waybilledCount: 0 };
  const outsideStats = { totalDeliveries: 0, deliveredCount: 0, waybilledCount: 0 };

  for (const row of rows) {
    if (row.agent_id == null) continue;
    const agent = agentsMap.get(row.agent_id);
    if (!agent) continue;

    const stats = isLagosAgent(agent.locations) ? lagosStats : outsideStats;
    stats.totalDeliveries += 1;
    if (row.status === "Delivered") stats.deliveredCount += 1;
    if (row.status === "Waybilled") stats.waybilledCount += 1;
  }

  const overall = {
    totalDeliveries: lagosStats.totalDeliveries + outsideStats.totalDeliveries,
    deliveredCount: lagosStats.deliveredCount + outsideStats.deliveredCount,
    waybilledCount: lagosStats.waybilledCount + outsideStats.waybilledCount,
  };

  return [
    {
      location: "Overall",
      ...overall,
      deliveryRate: computeDeliveryRate(overall.deliveredCount, overall.totalDeliveries),
    },
    {
      location: "Lagos",
      ...lagosStats,
      deliveryRate: computeDeliveryRate(
        lagosStats.deliveredCount,
        lagosStats.totalDeliveries
      ),
    },
    {
      location: "Outside Lagos",
      ...outsideStats,
      deliveryRate: computeDeliveryRate(
        outsideStats.deliveredCount,
        outsideStats.totalDeliveries
      ),
    },
  ];
}

function breakdownFromRows(
  rows: DeliveryRow[],
  labels: Map<string, string>
): DeliveryBreakdownRow[] {
  const buckets = new Map<
    string,
    {
      waybilledValue: number;
      deliveredValue: number;
      waybilledCount: number;
      deliveredCount: number;
    }
  >();

  for (const row of rows) {
    const key = row.agent_id?.toString() ?? row.product_id ?? "unknown";
    const bucket = buckets.get(key) ?? {
      waybilledValue: 0,
      deliveredValue: 0,
      waybilledCount: 0,
      deliveredCount: 0,
    };
    const cost = num(row.cost);
    if (row.status === "Waybilled") {
      bucket.waybilledValue += cost;
      bucket.waybilledCount += 1;
    } else if (row.status === "Delivered") {
      bucket.deliveredValue += cost;
      bucket.deliveredCount += 1;
    }
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .map(([key, b]) => {
      const totalCount = b.waybilledCount + b.deliveredCount;
      return {
        key,
        label: labels.get(key) ?? key,
        waybilledValue: b.waybilledValue,
        deliveredValue: b.deliveredValue,
        balance: b.waybilledValue - b.deliveredValue,
        deliveryRate: computeDeliveryRate(b.deliveredCount, totalCount),
        waybilledCount: b.waybilledCount,
        deliveredCount: b.deliveredCount,
      };
    })
    .sort((a, b) => b.waybilledValue + b.deliveredValue - (a.waybilledValue + a.deliveredValue));
}

export async function fetchDeliveryBreakdownByAgent(
  organizationId: string | null,
  filters?: DeliveryAnalyticsFilters
): Promise<DeliveryBreakdownRow[]> {
  if (!organizationId) return [];
  const rows = await fetchFilteredDeliveryRows(organizationId, filters);
  const agentIds = [
    ...new Set(rows.map((r) => r.agent_id).filter(Boolean)),
  ] as number[];
  const agentsMap = await fetchAgentsMap(organizationId, agentIds);

  const buckets = new Map<
    string,
    {
      waybilledValue: number;
      deliveredValue: number;
      waybilledCount: number;
      deliveredCount: number;
    }
  >();

  for (const row of rows) {
    if (row.agent_id == null) continue;
    const key = String(row.agent_id);
    const bucket = buckets.get(key) ?? {
      waybilledValue: 0,
      deliveredValue: 0,
      waybilledCount: 0,
      deliveredCount: 0,
    };
    const cost = num(row.cost);
    if (row.status === "Waybilled") {
      bucket.waybilledValue += cost;
      bucket.waybilledCount += 1;
    } else if (row.status === "Delivered") {
      bucket.deliveredValue += cost;
      bucket.deliveredCount += 1;
    }
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .map(([key, b]) => {
      const totalCount = b.waybilledCount + b.deliveredCount;
      return {
        key,
        label: agentsMap.get(Number(key))?.name ?? `Agent #${key}`,
        waybilledValue: b.waybilledValue,
        deliveredValue: b.deliveredValue,
        balance: b.waybilledValue - b.deliveredValue,
        deliveryRate: computeDeliveryRate(b.deliveredCount, totalCount),
        waybilledCount: b.waybilledCount,
        deliveredCount: b.deliveredCount,
      };
    })
    .sort(
      (a, b) =>
        b.waybilledValue + b.deliveredValue - (a.waybilledValue + a.deliveredValue)
    );
}

export async function fetchDeliveryBreakdownByProduct(
  organizationId: string | null,
  filters?: DeliveryAnalyticsFilters
): Promise<DeliveryBreakdownRow[]> {
  if (!organizationId) return [];
  const rows = await fetchFilteredDeliveryRows(organizationId, filters);
  const productIds = [...new Set(rows.map((r) => r.product_id))];
  const productsMap = await fetchProductsMap(organizationId, productIds);
  return breakdownFromRows(rows, productsMap);
}

export async function fetchDeliveryBreakdownByLocation(
  organizationId: string | null,
  filters?: DeliveryAnalyticsFilters
): Promise<DeliveryBreakdownRow[]> {
  if (!organizationId) return [];
  const rows = await fetchFilteredDeliveryRows(organizationId, {
    ...filters,
    location: "all",
  });
  const agentIds = [
    ...new Set(rows.map((r) => r.agent_id).filter(Boolean)),
  ] as number[];
  const agentsMap = await fetchAgentsMap(organizationId, agentIds);

  const buckets = new Map<
    string,
    {
      waybilledValue: number;
      deliveredValue: number;
      waybilledCount: number;
      deliveredCount: number;
    }
  >();

  for (const row of rows) {
    if (row.agent_id == null) continue;
    const agent = agentsMap.get(row.agent_id);
    if (!agent) continue;
    const key = isLagosAgent(agent.locations) ? "lagos" : "outside_lagos";
    const bucket = buckets.get(key) ?? {
      waybilledValue: 0,
      deliveredValue: 0,
      waybilledCount: 0,
      deliveredCount: 0,
    };
    const cost = num(row.cost);
    if (row.status === "Waybilled") {
      bucket.waybilledValue += cost;
      bucket.waybilledCount += 1;
    } else if (row.status === "Delivered") {
      bucket.deliveredValue += cost;
      bucket.deliveredCount += 1;
    }
    buckets.set(key, bucket);
  }

  const labels = new Map([
    ["lagos", "Lagos"],
    ["outside_lagos", "Outside Lagos"],
  ]);

  return [...buckets.entries()].map(([key, b]) => {
    const totalCount = b.waybilledCount + b.deliveredCount;
    return {
      key,
      label: labels.get(key) ?? key,
      waybilledValue: b.waybilledValue,
      deliveredValue: b.deliveredValue,
      balance: b.waybilledValue - b.deliveredValue,
      deliveryRate: computeDeliveryRate(b.deliveredCount, totalCount),
      waybilledCount: b.waybilledCount,
      deliveredCount: b.deliveredCount,
    };
  });
}

/** Legacy overview — maps to headline + outside-Lagos slice */
export async function fetchDeliveryAnalyticsOverview(
  organizationId: string | null,
  dateFilter?: DateFilter
): Promise<DeliveryAnalyticsOverview> {
  const headline = await fetchDeliveryAnalyticsHeadline(organizationId, {
    dateFilter,
  });
  const outsideRows = await fetchFilteredDeliveryRows(organizationId, {
    dateFilter,
    location: "outside_lagos",
  });
  let outsideWaybilled = 0;
  let outsideDelivered = 0;
  let deliveriesOutsideLagos = 0;
  for (const row of outsideRows) {
    if (row.status === "Waybilled") outsideWaybilled += num(row.cost);
    if (row.status === "Delivered") {
      outsideDelivered += num(row.cost);
      deliveriesOutsideLagos += 1;
    }
  }

  return {
    totalWaybills: headline.waybilledCount,
    waybillProductCost: headline.waybilledValue,
    totalDeliveriesDone: headline.deliveredCount,
    deliveriesOutsideLagos,
    valueOfGoodsOutside: outsideWaybilled - outsideDelivered,
  };
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
