"use client";

import { apiRequest } from "../lib/apiClient";
import { AgentStockOnHandRow } from "../types/stockMovement";

interface StockGridCellDto {
  agentId: number;
  agentName: string;
  isWarehouse: boolean;
  productId: string;
  productName: string;
  quantityOnHand: number;
}

/** True ledger on-hand, one row per (agent, product) with any recorded movement. */
export async function fetchAgentStockOnHand(
  _organizationId: string
): Promise<AgentStockOnHandRow[]> {
  const { cells } = await apiRequest<{ cells: StockGridCellDto[] }>("/org/numbatrak/inventory/grid");
  return cells.map((c) => ({
    organization_id: _organizationId,
    agent_id: c.agentId,
    product_id: c.productId,
    quantity_on_hand: c.quantityOnHand,
    agent_name: c.agentName,
    product_name: c.productName,
    is_warehouse: c.isWarehouse,
  }));
}

export async function getAgentProductOnHand(
  organizationId: string,
  agentId: number,
  productId: string
): Promise<number> {
  const rows = await fetchAgentStockOnHand(organizationId);
  const row = rows.find((r) => r.agent_id === agentId && r.product_id === productId);
  return row?.quantity_on_hand ?? 0;
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
