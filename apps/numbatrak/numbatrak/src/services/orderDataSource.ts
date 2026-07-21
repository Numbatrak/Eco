"use client";

import { supabase } from "../supabaseClient";
import type { MetricsOrderRow } from "./dashboardMetrics";
import { withinDateRange } from "./dashboardProjection";
import { isDeliveredStatus } from "../constants/orderStatus";

/** True when Supabase/PostgREST reports the relation is missing (greenfield not migrated). */
export function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  const msg = e.message?.toLowerCase() ?? "";
  return (
    e.code === "42P01" ||
    e.code === "PGRST205" ||
    msg.includes("schema cache") ||
    msg.includes("does not exist") ||
    msg.includes("could not exist") ||
    msg.includes("could not find")
  );
}

/** Shared filters for orders across dashboard, intake, and wallet. */
export type OrderScopeFilters = {
  formId?: string | null;
  csrId?: string | null;
  subBrand?: string | null;
  funnelName?: string | null;
  offerName?: string | null;
  agentId?: number | null;
};

export type UnifiedMetricsOrderRow = MetricsOrderRow & {
  form_id?: string | null;
  form_response_id?: string | null;
  offer_name?: string | null;
  funnel_name?: string | null;
  sub_brand?: string | null;
  money_received_by?: string | null;
  payment_method?: string | null;
  /** Which table this row came from — for updates/deletes */
  _source: "customer_orders" | "form_responses";
};

const METRICS_SELECT =
  "id, status, created_at, completed_at, order_revenue, order_cost, delivery_fee, profit, form_id, agent_id, offer_name, funnel_name, sub_brand, money_received_by, payment_method";

const FORM_METRICS_SELECT = `${METRICS_SELECT}, form_response_id:id`;

function applyOrderScopeFilters<
  T extends {
    eq: (col: string, val: string) => T;
  }
>(query: T, scope: OrderScopeFilters): T {
  let q = query;
  if (scope.formId) {
    q = q.eq("form_id", scope.formId);
  }
  if (scope.csrId) {
    q = q.eq("csr_id", scope.csrId);
  }
  if (scope.subBrand) {
    q = q.eq("sub_brand", scope.subBrand);
  }
  if (scope.funnelName) {
    q = q.eq("funnel_name", scope.funnelName);
  }
  if (scope.offerName) {
    q = q.eq("offer_name", scope.offerName);
  }
  if (scope.agentId != null) {
    q = q.eq("agent_id", scope.agentId);
  }
  return q;
}

async function fetchMetricsFromCustomerOrders(
  organizationId: string,
  scope: OrderScopeFilters
): Promise<UnifiedMetricsOrderRow[] | null> {
  let query = supabase
    .from("customer_orders")
    .select(`${METRICS_SELECT}, form_response_id`)
    .eq("organization_id", organizationId);

  query = applyOrderScopeFilters(query, scope);

  const { data, error } = await query;
  if (error) {
    if (isMissingTableError(error)) {
      return null;
    }
    throw error;
  }
  return (data || []).map((row) => ({
    ...(row as MetricsOrderRow),
    form_id: (row as { form_id?: string }).form_id ?? null,
    form_response_id: (row as { form_response_id?: string }).form_response_id ?? null,
    offer_name: (row as { offer_name?: string }).offer_name ?? null,
    funnel_name: (row as { funnel_name?: string }).funnel_name ?? null,
    sub_brand: (row as { sub_brand?: string }).sub_brand ?? null,
    money_received_by: (row as { money_received_by?: string }).money_received_by ?? null,
    payment_method: (row as { payment_method?: string }).payment_method ?? null,
    _source: "customer_orders" as const,
  }));
}

async function fetchMetricsFromFormResponses(
  organizationId: string,
  scope: OrderScopeFilters,
  excludeFormResponseIds?: Set<string>
): Promise<UnifiedMetricsOrderRow[]> {
  let query = supabase
    .from("form_responses")
    .select(FORM_METRICS_SELECT)
    .eq("organization_id", organizationId)
    .eq("response_type", "order");

  query = applyOrderScopeFilters(query, scope);

  const { data, error } = await query;
  if (error) {
    if (isMissingColumnError(error)) {
      return fetchMetricsFromFormResponsesLegacy(organizationId, scope, excludeFormResponseIds);
    }
    console.error("orderDataSource: form_responses", error);
    return [];
  }

  return (data || [])
    .filter((row) => {
      const id = String((row as { id: string }).id);
      return !excludeFormResponseIds?.has(id);
    })
    .map((row) => ({
      ...(row as MetricsOrderRow),
      form_id: (row as { form_id?: string }).form_id ?? null,
      form_response_id: (row as { id: string }).id,
      offer_name: (row as { offer_name?: string }).offer_name ?? null,
      funnel_name: (row as { funnel_name?: string }).funnel_name ?? null,
      sub_brand: (row as { sub_brand?: string }).sub_brand ?? null,
      money_received_by: (row as { money_received_by?: string }).money_received_by ?? null,
      payment_method: (row as { payment_method?: string }).payment_method ?? null,
      _source: "form_responses" as const,
    }));
}

function isMissingColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  return e.code === "42703" || (e.message?.includes("column") ?? false);
}

/** Fallback when attribution columns are not migrated yet. */
async function fetchMetricsFromFormResponsesLegacy(
  organizationId: string,
  scope: OrderScopeFilters,
  excludeFormResponseIds?: Set<string>
): Promise<UnifiedMetricsOrderRow[]> {
  let query = supabase
    .from("form_responses")
    .select("id, status, created_at, completed_at, order_revenue, order_cost, delivery_fee, profit, form_id, offer_name, payment_method")
    .eq("organization_id", organizationId)
    .eq("response_type", "order");

  if (scope.formId) {
    query = query.eq("form_id", scope.formId);
  }
  if (scope.csrId) {
    query = query.eq("csr_id", scope.csrId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("orderDataSource: form_responses legacy", error);
    return [];
  }

  return (data || [])
    .filter((row) => {
      const id = String((row as { id: string }).id);
      return !excludeFormResponseIds?.has(id);
    })
    .map((row) => ({
      ...(row as MetricsOrderRow),
      form_id: (row as { form_id?: string }).form_id ?? null,
      form_response_id: (row as { id: string }).id,
      offer_name: (row as { offer_name?: string }).offer_name ?? null,
      funnel_name: null,
      sub_brand: null,
      money_received_by: null,
      payment_method: (row as { payment_method?: string }).payment_method ?? null,
      _source: "form_responses" as const,
    }));
}

async function fetchLinkedFormResponseIds(organizationId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("customer_orders")
    .select("form_response_id")
    .eq("organization_id", organizationId)
    .not("form_response_id", "is", null);

  if (error) {
    if (isMissingTableError(error)) return new Set();
    throw error;
  }

  return new Set(
    (data || [])
      .map((r: { form_response_id: string | null }) => r.form_response_id)
      .filter((id): id is string => id != null)
  );
}

/**
 * Single revenue-truth order rows for metrics.
 * Prefers `customer_orders`; merges unmigrated `form_responses` not linked to v2.
 */
export async function fetchMetricsOrderRows(
  organizationId: string,
  formId?: string | null,
  csrId?: string | null,
  scope: Omit<OrderScopeFilters, "formId" | "csrId"> = {}
): Promise<MetricsOrderRow[]> {
  const filters: OrderScopeFilters = { formId, csrId, ...scope };
  const fromV2 = await fetchMetricsFromCustomerOrders(organizationId, filters);

  if (fromV2 === null) {
    const legacy = await fetchMetricsFromFormResponses(organizationId, filters);
    return legacy;
  }

  const linkedFrIds = new Set(
    fromV2
      .map((r) => r.form_response_id)
      .filter((id): id is string => id != null)
  );
  const orphans = await fetchMetricsFromFormResponses(
    organizationId,
    filters,
    linkedFrIds
  );

  return [...fromV2, ...orphans];
}

export async function fetchUnifiedMetricsOrderRows(
  organizationId: string,
  formId?: string | null,
  csrId?: string | null,
  scope: Omit<OrderScopeFilters, "formId" | "csrId"> = {}
): Promise<UnifiedMetricsOrderRow[]> {
  const filters: OrderScopeFilters = { formId, csrId, ...scope };
  const fromV2 = await fetchMetricsFromCustomerOrders(organizationId, filters);

  if (fromV2 === null) {
    return fetchMetricsFromFormResponses(organizationId, filters);
  }

  const linkedFrIds = new Set(
    fromV2
      .map((r) => r.form_response_id)
      .filter((id): id is string => id != null)
  );
  const orphans = await fetchMetricsFromFormResponses(
    organizationId,
    filters,
    linkedFrIds
  );

  return [...fromV2, ...orphans];
}

/** Count generated orders (non-cancelled) in optional created_at window. */
export async function countGeneratedOrders(
  organizationId: string,
  startDate?: string,
  endDate?: string,
  formId?: string | null,
  csrId?: string | null,
  scope: Omit<OrderScopeFilters, "formId" | "csrId"> = {}
): Promise<number> {
  const rows = await fetchMetricsOrderRows(organizationId, formId, csrId, scope);
  return rows.filter((row) => {
    if (row.status === "cancelled") return false;
    return withinDateRange(row.created_at, startDate, endDate);
  }).length;
}

/** Sum profit from delivered orders in optional completed_at window. */
export async function sumDeliveredOrderProfit(
  organizationId: string,
  startDate?: string,
  endDate?: string,
  formId?: string | null,
  csrId?: string | null,
  scope: Omit<OrderScopeFilters, "formId" | "csrId"> = {}
): Promise<number> {
  const rows = await fetchMetricsOrderRows(organizationId, formId, csrId, scope);
  return rows
    .filter((row) => isDeliveredStatus(row.status))
    .filter((row) =>
      withinDateRange(row.completed_at || row.created_at, startDate, endDate)
    )
    .reduce((sum, row) => {
      const n = Number(row.profit);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
}

/** Whether greenfield customer_orders table is available (probe). */
export async function isCustomerOrdersAvailable(
  organizationId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("customer_orders")
    .select("id", { head: true, count: "exact" })
    .eq("organization_id", organizationId)
    .limit(1);
  return !error || !isMissingTableError(error);
}
