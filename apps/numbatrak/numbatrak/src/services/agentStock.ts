"use client";

import { supabase } from "../supabaseClient";
import {
  AgentStockBreakdownRow,
  AgentStockOnHandRow,
} from "../types/stockMovement";

/**
 * Per-agent, per-product waybilled vs delivered (from `agent_stock_breakdown_v`)
 * @deprecated Prefer fetchAgentStockOnHand for true ledger on-hand.
 */
export async function fetchAgentStockBreakdown(
  organizationId: string
): Promise<AgentStockBreakdownRow[]> {
  const { data, error } = await supabase
    .from("agent_stock_breakdown_v")
    .select("*")
    .eq("organization_id", organizationId);

  if (error) {
    throw error;
  }

  const rows = (data || []) as any[];
  if (rows.length === 0) {
    return [];
  }

  const agentIds = [...new Set(rows.map((r) => Number(r.agent_id)))];
  const productIds = [...new Set(rows.map((r) => r.product_id as string))];

  const [agentsR, productsR] = await Promise.all([
    supabase.from("agents").select("id, name").in("id", agentIds),
    supabase.from("products").select("id, name").in("id", productIds),
  ]);
  const agentName = new Map(
    (agentsR.data || []).map((a: any) => [Number(a.id), a.name as string])
  );
  const productName = new Map(
    (productsR.data || []).map((p: any) => [p.id as string, p.name as string])
  );

  return rows.map((r) => ({
    organization_id: r.organization_id,
    agent_id: Number(r.agent_id),
    product_id: r.product_id,
    waybilled_in: Number(r.waybilled_in) || 0,
    delivered_to_customer: Number(r.delivered_to_customer) || 0,
    approx_remaining: Number(r.approx_remaining) || 0,
    agent_name: agentName.get(Number(r.agent_id)) || "N/A",
    product_name: productName.get(r.product_id) || "N/A",
  }));
}

/** True ledger on-hand from `agent_stock_v` (all movement types). */
export async function fetchAgentStockOnHand(
  organizationId: string
): Promise<AgentStockOnHandRow[]> {
  const { data, error } = await supabase
    .from("agent_stock_v")
    .select("*")
    .eq("organization_id", organizationId);

  if (error) {
    throw error;
  }

  const rows = (data || []) as any[];
  if (!rows.length) return [];

  const agentIds = [...new Set(rows.map((r) => Number(r.agent_id)))];
  const productIds = [...new Set(rows.map((r) => r.product_id as string))];

  const [agentsR, productsR] = await Promise.all([
    supabase
      .from("agents")
      .select("id, name, is_warehouse")
      .in("id", agentIds),
    supabase.from("products").select("id, name").in("id", productIds),
  ]);

  const agentMap = new Map(
    (agentsR.data || []).map((a: any) => [
      Number(a.id),
      { name: a.name as string, is_warehouse: a.is_warehouse === true },
    ])
  );
  const productName = new Map(
    (productsR.data || []).map((p: any) => [p.id as string, p.name as string])
  );

  return rows.map((r) => {
    const agent = agentMap.get(Number(r.agent_id));
    return {
      organization_id: r.organization_id,
      agent_id: Number(r.agent_id),
      product_id: r.product_id,
      quantity_on_hand: Number(r.quantity_on_hand) || 0,
      agent_name: agent?.name || "N/A",
      product_name: productName.get(r.product_id) || "N/A",
      is_warehouse: agent?.is_warehouse,
    };
  });
}

export async function getAgentProductOnHand(
  organizationId: string,
  agentId: number,
  productId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("agent_stock_v")
    .select("quantity_on_hand")
    .eq("organization_id", organizationId)
    .eq("agent_id", agentId)
    .eq("product_id", productId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return Number(data?.quantity_on_hand) || 0;
}

/** Map agent_id → product_id → on-hand qty */
export function buildOnHandMap(rows: AgentStockOnHandRow[]) {
  const map = new Map<number, Map<string, number>>();
  for (const r of rows) {
    if (!map.has(r.agent_id)) map.set(r.agent_id, new Map());
    map.get(r.agent_id)!.set(r.product_id, r.quantity_on_hand);
  }
  return map;
}
