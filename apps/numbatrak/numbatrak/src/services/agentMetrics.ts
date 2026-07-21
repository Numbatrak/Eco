"use client";

import { supabase } from "../supabaseClient";
import { isDeliveredStatus } from "../constants/orderStatus";
import { fetchAgentStockOnHand } from "./agentStock";
import { fetchWalletRemittanceLines } from "./wallet";
import type { WalletRemittanceLine } from "../types/wallet";

export type AgentMetrics = {
  agent_id: number;
  /** Sum of on-hand units across all products */
  stock_units: number;
  orders_generated: number;
  orders_delivered: number;
  /** 0–100; null when no orders assigned */
  delivery_rate: number | null;
};

const EMPTY_METRICS = (agentId: number): AgentMetrics => ({
  agent_id: agentId,
  stock_units: 0,
  orders_generated: 0,
  orders_delivered: 0,
  delivery_rate: null,
});

function isGeneratedOrder(status: string): boolean {
  return status !== "cancelled";
}

/**
 * Per-agent stock totals and order delivery rate (generated vs delivered).
 */
export async function fetchAgentMetricsMap(
  organizationId: string
): Promise<Map<number, AgentMetrics>> {
  const map = new Map<number, AgentMetrics>();

  const [stockRows, ordersResult] = await Promise.all([
    fetchAgentStockOnHand(organizationId),
    supabase
      .from("customer_orders")
      .select("agent_id, status")
      .eq("organization_id", organizationId)
      .not("agent_id", "is", null),
  ]);

  if (ordersResult.error) {
    throw ordersResult.error;
  }

  for (const row of stockRows) {
    const id = row.agent_id;
    const existing = map.get(id) ?? EMPTY_METRICS(id);
    existing.stock_units += row.quantity_on_hand;
    map.set(id, existing);
  }

  for (const row of ordersResult.data || []) {
    const id = Number((row as { agent_id: number }).agent_id);
    if (!id) continue;
    const status = String((row as { status: string }).status);
    const existing = map.get(id) ?? EMPTY_METRICS(id);
    if (isGeneratedOrder(status)) {
      existing.orders_generated += 1;
    }
    if (isDeliveredStatus(status)) {
      existing.orders_delivered += 1;
    }
    map.set(id, existing);
  }

  for (const metrics of map.values()) {
    metrics.delivery_rate =
      metrics.orders_generated > 0
        ? (metrics.orders_delivered / metrics.orders_generated) * 100
        : null;
  }

  return map;
}

export async function fetchAgentMetrics(
  organizationId: string,
  agentId: number
): Promise<AgentMetrics> {
  const map = await fetchAgentMetricsMap(organizationId);
  return map.get(agentId) ?? EMPTY_METRICS(agentId);
}

export async function fetchAgentRemittanceHistory(
  organizationId: string,
  agentId: number
): Promise<WalletRemittanceLine[]> {
  const lines = await fetchWalletRemittanceLines(organizationId);
  return lines.filter((line) => line.agent_id === agentId);
}

export function formatDeliveryRate(rate: number | null | undefined): string {
  if (rate == null || Number.isNaN(rate)) return "—";
  return `${rate.toFixed(1)}%`;
}
