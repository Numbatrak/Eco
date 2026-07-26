"use client";

import { apiRequest } from "../lib/apiClient";
import { fetchAgents } from "./agents";
import { fetchProducts } from "./products";
import { fetchDeliveries } from "./deliveries";
import { fetchCustomerOrders } from "./customerOrders";
import { fetchAbandonedCarts } from "./abandonedCarts";
import { DateFilter, resolveDateRange } from "../utils/dateRange";

/**
 * Org-wide agent + product counts for dashboard KPIs. The source app's
 * totalProducts actually meant "order-intake forms count, falling back to
 * SKU catalog count" - Forms isn't ported, so this always uses the catalog
 * count now (the fallback path the source already had).
 */
export async function fetchDashboardOrgCounts(
  organizationId: string | null
): Promise<{ totalAgents: number; totalProducts: number }> {
  if (!organizationId) {
    return { totalAgents: 0, totalProducts: 0 };
  }
  const [agents, products] = await Promise.all([
    fetchAgents(organizationId),
    fetchProducts(organizationId),
  ]);
  return { totalAgents: agents.length, totalProducts: products.length };
}

/**
 * Get the 5 most recent deliveries with agent/product names - now just a
 * thin slice over the already-ported fetchDeliveries (which already embeds
 * agent/product names server-side), not its own Supabase query.
 */
export async function fetchLatestDeliveries(organizationId: string | null) {
  if (!organizationId) return [];
  const deliveries = await fetchDeliveries(organizationId);
  return deliveries.slice(0, 5).map((row) => ({
    id: row.id,
    date: row.date,
    status: row.status,
    product: row.product?.name || "Unknown",
    agent: row.agent?.name || "N/A",
    quantity: row.quantity,
    cost: row.cost,
  }));
}

/**
 * Get the 5 most recent orders, optionally scoped to a form/CSR - now a
 * thin slice over the already-ported fetchCustomerOrders. formId scoping is
 * unavailable (Forms isn't ported) and silently ignored, same graceful
 * degradation as the rest of this port.
 */
export async function fetchLatestOrders(
  organizationId: string | null,
  formId?: string | null,
  csrId?: string | null
) {
  if (!organizationId) return [];
  void formId;
  const orders = await fetchCustomerOrders(organizationId, csrId ? { csr_id: csrId } : {});
  return orders.slice(0, 5).map((row) => {
    const firstItem = row.items[0];
    const productName = firstItem ? row.productNames?.[firstItem.product_id] || "N/A" : "N/A";
    return {
      id: row.id,
      customer_name: row.customer_name || "N/A",
      phone_number: row.phone_number || "N/A",
      location: row.state || "N/A",
      order_date: row.created_at || new Date().toISOString(),
      product_name: productName,
      order_status: row.status || "pending",
      sales_price: row.order_revenue,
    };
  });
}

/**
 * Get the 5 most recent abandoned carts worth following up on (has a name
 * AND a phone/whatsapp, not yet converted) - now a thin slice over the
 * already-ported fetchAbandonedCarts. That backend route has no "has
 * name+contact" filter (a Dashboard-specific business rule), so this
 * over-fetches a small buffer and applies the filter client-side.
 */
export async function fetchLatestAbandonedCarts(
  organizationId: string | null,
  formId?: string | null
) {
  if (!organizationId) return [];
  const carts = await fetchAbandonedCarts(organizationId, 0, 20, "desc", undefined, {
    converted: false,
    formId: formId ?? undefined,
  });
  const eligible = carts.filter(
    (c) => c.customer_name?.trim() && (c.phone_number?.trim() || c.whatsapp_number?.trim())
  );
  return eligible.slice(0, 5).map((row) => ({
    id: row.id,
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
    sales_price: row.sales_price,
    filled_fields_count: row.filled_fields_count || 0,
  }));
}

export interface DeliveryRateByLocation {
  location: "Lagos" | "Outside Lagos" | "Overall";
  totalDeliveries: number;
  deliveredCount: number;
  waybilledCount: number;
  deliveryRate: number;
}

/**
 * Get delivery rate statistics for Lagos vs Outside Lagos - computed
 * server-side now (packages the same agent-locations bucketing logic).
 */
export async function fetchDeliveryRateByLocation(
  organizationId: string | null,
  dateFilter?: DateFilter
): Promise<DeliveryRateByLocation[]> {
  const empty: DeliveryRateByLocation[] = [
    { location: "Overall", totalDeliveries: 0, deliveredCount: 0, waybilledCount: 0, deliveryRate: 0 },
    { location: "Lagos", totalDeliveries: 0, deliveredCount: 0, waybilledCount: 0, deliveryRate: 0 },
    { location: "Outside Lagos", totalDeliveries: 0, deliveredCount: 0, waybilledCount: 0, deliveryRate: 0 },
  ];
  if (!organizationId) return empty;

  const { startDate, endDate } = resolveDateRange(dateFilter);
  const params = new URLSearchParams();
  if (startDate) params.set("dateFrom", startDate);
  if (endDate) params.set("dateTo", endDate);

  const { rates } = await apiRequest<{ rates: DeliveryRateByLocation[] }>(
    `/org/numbatrak/dashboard/delivery-rate-by-location?${params.toString()}`
  );
  return rates;
}
