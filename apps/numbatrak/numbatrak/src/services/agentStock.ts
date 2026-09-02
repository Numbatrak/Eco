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

export interface StockGridFilters {
  agentId?: number;
  productId?: string;
  subBrand?: string;
  location?: string;
}

/**
 * True ledger on-hand, one row per (agent, product) with any recorded
 * movement, plus the server-computed cost-of-inventory total (every agent's
 * holdings x cost price, summed org-wide - unaffected by `filters`, which
 * only narrow which grid cells come back).
 */
export async function fetchStockGrid(
  organizationId: string,
  filters: StockGridFilters = {}
): Promise<{ rows: AgentStockOnHandRow[]; costOfInventory: number }> {
  const params = new URLSearchParams();
  if (filters.agentId != null) params.set("agentId", String(filters.agentId));
  if (filters.productId) params.set("productId", filters.productId);
  if (filters.subBrand) params.set("subBrand", filters.subBrand);
  if (filters.location) params.set("location", filters.location);
  const qs = params.toString();

  const { cells, costOfInventory } = await apiRequest<{
    cells: StockGridCellDto[];
    costOfInventory: string;
  }>(`/org/numbatrak/inventory/grid${qs ? `?${qs}` : ""}`);
  return {
    rows: cells.map((c) => ({
      organization_id: organizationId,
      agent_id: c.agentId,
      product_id: c.productId,
      quantity_on_hand: c.quantityOnHand,
      agent_name: c.agentName,
      product_name: c.productName,
      is_warehouse: c.isWarehouse,
    })),
    costOfInventory: Number(costOfInventory),
  };
}

/** True ledger on-hand, one row per (agent, product) with any recorded movement. */
export async function fetchAgentStockOnHand(
  organizationId: string
): Promise<AgentStockOnHandRow[]> {
  const { rows } = await fetchStockGrid(organizationId);
  return rows;
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
