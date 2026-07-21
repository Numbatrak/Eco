"use client";

import { supabase } from "../supabaseClient";
import { DateFilter, resolveDateRange, withinDateRange } from "../utils/dateRange";
import {
  extractCustomerName,
  extractLocation,
  extractPackageName,
  extractPhoneNumber,
} from "../utils/formResponseHelpers";
import { fetchAgents } from "./agents";
import { fetchProducts } from "./products";
import { fetchDeliveries } from "./deliveries";
import { fetchUnifiedExpenseTotals } from "./expenseSummary";
import { fetchInventorySummary } from "./inventory";
import {
  countGeneratedOrders,
  sumDeliveredOrderProfit,
} from "./orderDataSource";

export interface DashboardStats {
  totalAgents: number;
  totalProducts: number;
  totalDeliveries: number;
  totalOrders: number;
  totalAgentExpenses: number;
  totalGeneralExpenses: number;
  waybilledCount: number;
  deliveredCount: number;
  totalInventoryValue: number;
  totalProfit: number;
}

export const EMPTY_DASHBOARD_STATS: DashboardStats = {
  totalAgents: 0,
  totalProducts: 0,
  totalDeliveries: 0,
  totalOrders: 0,
  totalAgentExpenses: 0,
  totalGeneralExpenses: 0,
  waybilledCount: 0,
  deliveredCount: 0,
  totalInventoryValue: 0,
  totalProfit: 0,
};

/** Org-wide agent + order-form counts for dashboard KPIs (isolated from heavy stats bundle). */
export async function fetchDashboardOrgCounts(
  organizationId: string | null
): Promise<{ totalAgents: number; totalProducts: number }> {
  if (!organizationId) {
    return { totalAgents: 0, totalProducts: 0 };
  }

  const [agentsRes, formsRes, productsRes] = await Promise.all([
    supabase
      .from("agents")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId),
    supabase
      .from("forms")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId),
  ]);

  if (agentsRes.error) {
    console.error("fetchDashboardOrgCounts agents:", agentsRes.error);
  }
  if (formsRes.error) {
    console.error("fetchDashboardOrgCounts forms:", formsRes.error);
  }
  if (productsRes.error) {
    console.error("fetchDashboardOrgCounts products:", productsRes.error);
  }

  const formsCount = formsRes.error ? 0 : formsRes.count ?? 0;
  const catalogCount = productsRes.error ? 0 : productsRes.count ?? 0;

  return {
    totalAgents: agentsRes.error ? 0 : agentsRes.count ?? 0,
    // Prefer order forms (dashboard product filter); fall back to SKU catalog.
    totalProducts: formsCount || catalogCount,
  };
}

/**
 * Fetch total profit from completed form responses with optional date filtering
 * Only counts profit from form responses with status = 'completed'
 * Uses completed_at timestamp for timeline filtering (not created_at)
 * @param organizationId Organization ID to filter by
 * @param startDate Optional start date (ISO string) - filters by completed_at
 * @param endDate Optional end date (ISO string) - filters by completed_at
 * @param formId Optional form ID — when set, only responses for that form are included
 * @returns Total profit as number
 */
export async function fetchTotalProfit(
  organizationId: string | null,
  startDate?: string,
  endDate?: string,
  formId?: string | null,
  csrId?: string | null
): Promise<number> {
  if (!organizationId) {
    return 0;
  }
  try {
    return await sumDeliveredOrderProfit(
      organizationId,
      startDate,
      endDate,
      formId,
      csrId
    );
  } catch (error) {
    console.error("Error calculating total profit:", error);
    return 0;
  }
}

export async function fetchDashboardStats(
  organizationId: string | null,
  startDate?: string,
  endDate?: string,
  formId?: string | null,
  csrId?: string | null
): Promise<DashboardStats> {
  if (!organizationId) return EMPTY_DASHBOARD_STATS;

  try {
    const totalOrdersPromise = countGeneratedOrders(
      organizationId,
      startDate,
      endDate,
      formId,
      csrId
    );

    // Fetch all data in parallel — org counts are isolated so a failure elsewhere does not zero KPIs
    const orgCounts = await fetchDashboardOrgCounts(organizationId);

    const [
      agentsResult,
      productsResult,
      deliveriesResult,
      totalOrdersResult,
      unifiedExpenseTotalsResult,
      inventorySummaryResult,
      totalProfitResult,
    ] = await Promise.allSettled([
      fetchAgents(organizationId),
      fetchProducts(organizationId),
      fetchDeliveries(organizationId),
      totalOrdersPromise,
      fetchUnifiedExpenseTotals(organizationId, startDate, endDate),
      fetchInventorySummary(organizationId),
      fetchTotalProfit(organizationId, startDate, endDate, formId, csrId),
    ]);

    const agents =
      agentsResult.status === "fulfilled" ? agentsResult.value : [];
    const products =
      productsResult.status === "fulfilled" ? productsResult.value : [];
    const deliveries =
      deliveriesResult.status === "fulfilled" ? deliveriesResult.value : [];
    const totalOrders =
      totalOrdersResult.status === "fulfilled" ? totalOrdersResult.value : 0;
    const expenseTotals =
      unifiedExpenseTotalsResult.status === "fulfilled"
        ? unifiedExpenseTotalsResult.value
        : { totalAgentExpenses: 0, totalGeneralExpenses: 0 };
    const inventorySummary =
      inventorySummaryResult.status === "fulfilled"
        ? inventorySummaryResult.value
        : [];
    const totalProfit =
      totalProfitResult.status === "fulfilled" ? totalProfitResult.value : 0;

    if (agentsResult.status === "rejected") {
      console.error("fetchDashboardStats agents:", agentsResult.reason);
    }
    if (productsResult.status === "rejected") {
      console.error("fetchDashboardStats products:", productsResult.reason);
    }
    if (deliveriesResult.status === "rejected") {
      console.error("fetchDashboardStats deliveries:", deliveriesResult.reason);
    }
    if (totalOrdersResult.status === "rejected") {
      console.error("fetchDashboardStats orders:", totalOrdersResult.reason);
    }
    if (inventorySummaryResult.status === "rejected") {
      console.error(
        "fetchDashboardStats inventory:",
        inventorySummaryResult.reason
      );
    }

    // Filter deliveries by date if date filter is provided (inclusive range using provided boundaries)
    let filteredDeliveries = deliveries;
    if (startDate || endDate) {
      const startBound = startDate ? new Date(startDate) : null;
      const endBound = endDate ? new Date(endDate) : null;
      filteredDeliveries = deliveries.filter((d) => {
        const deliveryDate = new Date(d.date);
        if (startBound && deliveryDate < startBound) return false;
        if (endBound && deliveryDate > endBound) return false;
        return true;
      });
    }

    // Count waybilled vs delivered (use filtered deliveries if date filter is applied)
    const deliveriesToCount = filteredDeliveries;
    const waybilledCount = deliveriesToCount.filter(
      (d) => d.status === "Waybilled"
    ).length;
    const deliveredCount = deliveriesToCount.filter(
      (d) => d.status === "Delivered"
    ).length;

    const totalAgentExpenses = expenseTotals.totalAgentExpenses;
    const totalGeneralExpenses = expenseTotals.totalGeneralExpenses;

    // Calculate inventory value (simplified - using average price or just count)
    const totalInventoryValue = inventorySummary.reduce((total, agent) => {
      return (
        total +
        agent.products.reduce((agentTotal, product) => {
          return agentTotal + product.total;
        }, 0)
      );
    }, 0);

    return {
      totalAgents: orgCounts.totalAgents || agents.length,
      totalProducts: orgCounts.totalProducts || products.length,
      totalDeliveries: filteredDeliveries.length,
      totalOrders,
      totalAgentExpenses,
      totalGeneralExpenses,
      waybilledCount,
      deliveredCount,
      totalInventoryValue,
      totalProfit,
    };
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return EMPTY_DASHBOARD_STATS;
  }
}

/**
 * Get latest deliveries (most recent 5) for the current organisation.
 */
export async function fetchLatestDeliveries(organizationId: string | null) {
  if (!organizationId) {
    return [];
  }

  const { data: deliveries, error } = await supabase
    .from("deliveries")
    .select("*")
    .eq("organization_id", organizationId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    throw error;
  }

  if (!deliveries || deliveries.length === 0) {
    return [];
  }

  // Get unique agent and product IDs
  const agentIds = [
    ...new Set(deliveries.map((d: any) => d.agent_id).filter(Boolean)),
  ];
  const productIds = [
    ...new Set(deliveries.map((d: any) => d.product_id).filter(Boolean)),
  ];

  // Fetch agents and products separately
  const [agentsResult, productsResult] = await Promise.all([
    agentIds.length > 0
      ? supabase.from("agents").select("id, name").in("id", agentIds)
      : Promise.resolve({ data: [], error: null }),
    productIds.length > 0
      ? supabase.from("products").select("id, name").in("id", productIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  // Create maps for quick lookup
  const agentsMap = new Map(
    (agentsResult.data || []).map((a: any) => [Number(a.id), a.name])
  );
  const productsMap = new Map(
    (productsResult.data || []).map((p: any) => [String(p.id), p.name])
  );

  return deliveries.map((row: any) => ({
    id: Number(row.id),
    date: row.date,
    status: row.status as "Waybilled" | "Delivered",
    product: row.product_id
      ? productsMap.get(String(row.product_id)) || "Unknown"
      : "Unknown",
    agent: row.agent_id ? agentsMap.get(Number(row.agent_id)) || "N/A" : "N/A",
    quantity: Number(row.quantity),
    cost: Number(row.cost),
  }));
}

/**
 * Get latest order submissions (most recent 5) from `form_responses` for the org,
 * optionally scoped to a single form.
 */
export async function fetchLatestOrders(
  organizationId: string | null,
  formId?: string | null,
  csrId?: string | null
) {
  if (!organizationId) {
    return [];
  }

  const v2q = supabase
    .from("customer_orders")
    .select(
      "id, customer_name, phone_number, state, status, created_at, order_revenue, form_id, csr_id"
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(5);

  let v2 = v2q;
  if (formId) {
    v2 = v2.eq("form_id", formId);
  }
  if (csrId) {
    v2 = v2.eq("csr_id", csrId);
  }

  const { data: coRows, error: coErr } = await v2;

  if (!coErr && coRows && coRows.length > 0) {
    const orderIds = coRows.map((r: any) => r.id);
    const { data: lineItems } = await supabase
      .from("customer_order_items")
      .select("order_id, product_id")
      .in("order_id", orderIds);
    const pids = [
      ...new Set((lineItems || []).map((li: any) => li.product_id).filter(Boolean)),
    ] as string[];
    const { data: prods } = pids.length
      ? await supabase.from("products").select("id, name").in("id", pids)
      : { data: [] as { id: string; name: string }[] };
    const pname = new Map(
      (prods || []).map((p: any) => [p.id as string, p.name as string])
    );
    const firstProduct = new Map<string, string>();
    for (const li of lineItems || []) {
      const oid = (li as any).order_id as string;
      if (!firstProduct.has(oid)) {
        const n = pname.get((li as any).product_id) || "N/A";
        firstProduct.set(oid, n);
      }
    }
    return coRows.map((row: any) => ({
      id: String(row.id),
      customer_name: row.customer_name || "N/A",
      phone_number: row.phone_number || "N/A",
      location: row.state || "N/A",
      order_date: row.created_at || new Date().toISOString(),
      product_name: firstProduct.get(row.id) || "N/A",
      order_status: (row.status as string) || "pending",
      sales_price:
        row.order_revenue != null ? Number(row.order_revenue) : null,
    }));
  }

  let query = supabase
    .from("form_responses")
    .select(
      "id, customer_name, phone_number, package_name, field_values, status, created_at, order_revenue"
    )
    .eq("response_type", "order")
    .order("created_at", { ascending: false })
    .limit(5);

  query = query.eq("organization_id", organizationId);
  if (formId) {
    query = query.eq("form_id", formId);
  }
  if (csrId) {
    query = query.eq("csr_id", csrId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  if (!data) {
    return [];
  }

  return data.map((row: any) => {
    const fieldValues = row.field_values;
    const customerName =
      row.customer_name || extractCustomerName(fieldValues) || "N/A";
    const phone =
      row.phone_number || extractPhoneNumber(fieldValues) || "N/A";
    const productName =
      row.package_name || extractPackageName(fieldValues) || "N/A";
    const location = extractLocation(fieldValues) || "N/A";
    return {
      id: String(row.id),
      customer_name: customerName,
      phone_number: phone,
      location,
      order_date: row.created_at || new Date().toISOString(),
      product_name: productName,
      order_status: (row.status as string) || "pending",
      sales_price:
        row.order_revenue != null ? Number(row.order_revenue) : null,
    };
  });
}

/**
 * Get latest abandoned carts (most recent 5, not converted, filtered by organization)
 * Optionally restricted to a single form.
 */
export async function fetchLatestAbandonedCarts(
  organizationId: string | null,
  formId?: string | null
) {
  if (!organizationId) return [];

  let query = supabase
    .from("abandoned_carts")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("converted_to_order", false)
    .not("customer_name", "is", null)
    .neq("customer_name", "")
    .or("phone_number.not.is.null,whatsapp_number.not.is.null")
    .order("abandoned_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5);
  if (formId) {
    query = query.eq("form_id", formId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  if (!data) {
    return [];
  }

  return data.map((row: any) => ({
    id: String(row.id),
    customer_name: row.customer_name || "N/A",
    phone_number: row.phone_number || row.whatsapp_number || "N/A",
    location: row.location || row.state || "N/A",
    abandoned_at: row.abandoned_at,
    product_name:
      row.product_name ||
      row.offer_name ||
      row.selected_package ||
      (Array.isArray(row.selected_products) && row.selected_products.length > 0
        ? `${row.selected_products.length} product(s)`
        : "N/A"),
    sales_price: row.sales_price ? Number(row.sales_price) : null,
    filled_fields_count: row.filled_fields_count || 0,
  }));
}

/**
 * Waybill statistics by state/region
 */
export interface WaybillByState {
  state: string;
  totalQuantity: number;
  totalCost: number;
  waybillCount: number;
  earliestDate: string | null;
  latestDate: string | null;
  averageDaysSinceWaybill: number | null;
}

/**
 * Get waybill statistics grouped by state/region
 * Filters waybilled items by agent location (excluding Lagos as it's the central warehouse)
 *
 * @param startDate Optional start date filter (ISO string)
 * @param endDate Optional end date filter (ISO string)
 * @param stateFilter Optional state filter (if provided, only returns that state)
 */
export async function fetchWaybillsByState(
  organizationId: string | null,
  startDate?: string,
  endDate?: string,
  stateFilter?: string
): Promise<WaybillByState[]> {
  if (!organizationId) return [];

  try {
    let query = supabase
      .from("deliveries")
      .select("id, date, quantity, cost, status, agent_id")
      .eq("organization_id", organizationId)
      .eq("status", "Waybilled");

    // Apply date filters if provided
    if (startDate) {
      query = query.gte("date", startDate);
    }
    if (endDate) {
      query = query.lte("date", endDate);
    }

    const { data: deliveries, error } = await query.order("date", {
      ascending: false,
    });

    if (error) {
      throw error;
    }

    if (!deliveries || deliveries.length === 0) {
      return [];
    }

    // Fetch agents separately to get locations
    const agentIds = [
      ...new Set(deliveries.map((d: any) => d.agent_id).filter(Boolean)),
    ];
    const agentsResult =
      agentIds.length > 0
        ? await supabase
            .from("agents")
            .select("id, name, locations")
            .in("id", agentIds)
        : { data: [], error: null };

    const agentsMap = new Map(
      (agentsResult.data || []).map((a: any) => [Number(a.id), a])
    );

    // Parse agent locations and group by state
    const stateMap = new Map<
      string,
      {
        totalQuantity: number;
        totalCost: number;
        waybillCount: number;
        dates: string[];
      }
    >();

    const today = new Date();

    deliveries.forEach((row: any) => {
      const agent = row.agent_id ? agentsMap.get(Number(row.agent_id)) : null;
      if (!agent || !agent.locations) {
        return; // Skip deliveries without agent or location
      }

      // Parse locations (comma-separated string)
      const locations =
        typeof agent.locations === "string"
          ? agent.locations.split(",").map((loc: string) => loc.trim())
          : Array.isArray(agent.locations)
          ? agent.locations
          : [];

      // Filter out Lagos (central warehouse) and process other states
      const states = locations
        .map((loc: string) => loc.trim())
        .filter((loc: string) => loc && loc.toLowerCase() !== "lagos");

      if (states.length === 0) {
        return; // Skip if only Lagos or no valid states
      }

      // Use the first non-Lagos state (or filter if stateFilter is provided)
      // This ensures each waybill is counted only once
      let targetState: string | null = null;

      if (stateFilter) {
        // If filtering by state, check if any state matches
        const matchingState = states.find(
          (s: string) => s.toLowerCase() === stateFilter.toLowerCase()
        );
        if (matchingState) {
          targetState = matchingState;
        } else {
          return; // No match, skip this waybill
        }
      } else {
        // Use the first non-Lagos state
        targetState = states[0];
      }

      if (!targetState) {
        return;
      }

      const stateKey = targetState;

      if (!stateMap.has(stateKey)) {
        stateMap.set(stateKey, {
          totalQuantity: 0,
          totalCost: 0,
          waybillCount: 0,
          dates: [],
        });
      }

      const stateData = stateMap.get(stateKey)!;
      stateData.totalQuantity += Number(row.quantity) || 0;
      stateData.totalCost += Number(row.cost) || 0;
      stateData.waybillCount += 1;
      stateData.dates.push(row.date);
    });

    // Convert map to array and calculate additional metrics
    const result: WaybillByState[] = Array.from(stateMap.entries()).map(
      ([state, data]) => {
        const sortedDates = data.dates.sort(
          (a, b) => new Date(a).getTime() - new Date(b).getTime()
        );

        const earliestDate = sortedDates[0] || null;
        const latestDate = sortedDates[sortedDates.length - 1] || null;

        // Calculate average days since waybill
        let averageDaysSinceWaybill: number | null = null;
        if (sortedDates.length > 0) {
          const totalDays = sortedDates.reduce((sum, dateStr) => {
            const waybillDate = new Date(dateStr);
            const daysDiff = Math.floor(
              (today.getTime() - waybillDate.getTime()) / (1000 * 60 * 60 * 24)
            );
            return sum + daysDiff;
          }, 0);
          averageDaysSinceWaybill = Math.round(totalDays / sortedDates.length);
        }

        return {
          state,
          totalQuantity: data.totalQuantity,
          totalCost: data.totalCost,
          waybillCount: data.waybillCount,
          earliestDate,
          latestDate,
          averageDaysSinceWaybill,
        };
      }
    );

    // Sort by total quantity (fastest moving first)
    return result.sort((a, b) => b.totalQuantity - a.totalQuantity);
  } catch (error) {
    console.error("Error fetching waybills by state:", error);
    throw error;
  }
}

/**
 * Delivery rate statistics by location (Lagos vs Outside Lagos)
 */
export interface DeliveryRateByLocation {
  location: "Lagos" | "Outside Lagos" | "Overall";
  totalDeliveries: number;
  deliveredCount: number;
  waybilledCount: number;
  deliveryRate: number; // Percentage
}

/**
 * Get delivery rate statistics for Lagos vs Outside Lagos
 */
export async function fetchDeliveryRateByLocation(
  organizationId: string | null,
  dateFilter?: DateFilter
): Promise<DeliveryRateByLocation[]> {
  if (!organizationId) {
    return [
      {
        location: "Overall",
        totalDeliveries: 0,
        deliveredCount: 0,
        waybilledCount: 0,
        deliveryRate: 0,
      },
      {
        location: "Lagos",
        totalDeliveries: 0,
        deliveredCount: 0,
        waybilledCount: 0,
        deliveryRate: 0,
      },
      {
        location: "Outside Lagos",
        totalDeliveries: 0,
        deliveredCount: 0,
        waybilledCount: 0,
        deliveryRate: 0,
      },
    ];
  }

  try {
    const { startDate, endDate } = resolveDateRange(dateFilter);

    const { data: deliveries, error } = await supabase
      .from("deliveries")
      .select("id, date, status, agent_id")
      .eq("organization_id", organizationId);

    if (error) {
      throw error;
    }

    const data = (deliveries || []).filter((row: { date: string }) =>
      withinDateRange(row.date, startDate, endDate)
    );

    if (!data.length) {
      return [
        {
          location: "Overall",
          totalDeliveries: 0,
          deliveredCount: 0,
          waybilledCount: 0,
          deliveryRate: 0,
        },
        {
          location: "Lagos",
          totalDeliveries: 0,
          deliveredCount: 0,
          waybilledCount: 0,
          deliveryRate: 0,
        },
        {
          location: "Outside Lagos",
          totalDeliveries: 0,
          deliveredCount: 0,
          waybilledCount: 0,
          deliveryRate: 0,
        },
      ];
    }

    // Fetch agents separately
    const agentIds = [
      ...new Set(data.map((d: { agent_id: number | null }) => d.agent_id).filter(Boolean)),
    ];
    const agentsResult =
      agentIds.length > 0
        ? await supabase
            .from("agents")
            .select("id, name, locations")
            .in("id", agentIds)
        : { data: [], error: null };

    const agentsMap = new Map(
      (agentsResult.data || []).map((a: any) => [Number(a.id), a])
    );

    // Initialize counters
    const lagosStats = {
      totalDeliveries: 0,
      deliveredCount: 0,
      waybilledCount: 0,
    };

    const outsideLagosStats = {
      totalDeliveries: 0,
      deliveredCount: 0,
      waybilledCount: 0,
    };

    // Process each delivery
    data.forEach((row: any) => {
      const agent = row.agent_id ? agentsMap.get(Number(row.agent_id)) : null;
      if (!agent || !agent.locations) {
        // If no agent or location, skip or count as "Outside Lagos"?
        // For now, we'll skip deliveries without location info
        return;
      }

      // Parse locations (can be string or array)
      const locations =
        typeof agent.locations === "string"
          ? agent.locations.split(",").map((loc: string) => loc.trim())
          : Array.isArray(agent.locations)
          ? agent.locations
          : [];

      // Check if any location is Lagos (case-insensitive)
      const isLagos = locations.some(
        (loc: string) => loc.trim().toLowerCase() === "lagos"
      );

      const stats = isLagos ? lagosStats : outsideLagosStats;

      stats.totalDeliveries += 1;
      if (row.status === "Delivered") {
        stats.deliveredCount += 1;
      } else if (row.status === "Waybilled") {
        stats.waybilledCount += 1;
      }
    });

    // Calculate delivery rates
    const lagosRate =
      lagosStats.totalDeliveries > 0
        ? (lagosStats.deliveredCount / lagosStats.totalDeliveries) * 100
        : 0;

    const outsideLagosRate =
      outsideLagosStats.totalDeliveries > 0
        ? (outsideLagosStats.deliveredCount /
            outsideLagosStats.totalDeliveries) *
          100
        : 0;

    // Calculate overall stats
    const overallStats = {
      totalDeliveries:
        lagosStats.totalDeliveries + outsideLagosStats.totalDeliveries,
      deliveredCount:
        lagosStats.deliveredCount + outsideLagosStats.deliveredCount,
      waybilledCount:
        lagosStats.waybilledCount + outsideLagosStats.waybilledCount,
    };

    const overallRate =
      overallStats.totalDeliveries > 0
        ? (overallStats.deliveredCount / overallStats.totalDeliveries) * 100
        : 0;

    return [
      {
        location: "Overall",
        totalDeliveries: overallStats.totalDeliveries,
        deliveredCount: overallStats.deliveredCount,
        waybilledCount: overallStats.waybilledCount,
        deliveryRate: Number(overallRate.toFixed(1)),
      },
      {
        location: "Lagos",
        totalDeliveries: lagosStats.totalDeliveries,
        deliveredCount: lagosStats.deliveredCount,
        waybilledCount: lagosStats.waybilledCount,
        deliveryRate: Number(lagosRate.toFixed(1)),
      },
      {
        location: "Outside Lagos",
        totalDeliveries: outsideLagosStats.totalDeliveries,
        deliveredCount: outsideLagosStats.deliveredCount,
        waybilledCount: outsideLagosStats.waybilledCount,
        deliveryRate: Number(outsideLagosRate.toFixed(1)),
      },
    ];
  } catch (error) {
    console.error("Error fetching delivery rate by location:", error);
    throw error;
  }
}
