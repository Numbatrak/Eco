"use client";

import { apiRequest } from "../lib/apiClient";

export interface InventoryLot {
  id: string;
  organization_id: string;
  product_id: string;
  variant_id?: string | null;
  quantity_remaining: number;
  unit_cost: number;
  received_at: string;
  created_at?: string | null;
  updated_at?: string | null;
}

interface InventoryLotDto {
  id: string;
  organizationId: string;
  productId: string;
  variantId: string | null;
  quantityRemaining: number;
  unitCost: string;
  receivedAt: string;
}

/**
 * Create an inventory lot (receive stock) for FIFO consumption.
 */
export async function createInventoryLot(input: {
  organization_id: string;
  product_id: string;
  variant_id?: string | null;
  quantity_remaining: number;
  unit_cost: number;
  received_at?: string;
}): Promise<InventoryLot> {
  if (input.quantity_remaining < 0) {
    throw new Error("quantity_remaining cannot be negative");
  }
  if (input.unit_cost < 0) {
    throw new Error("unit_cost cannot be negative");
  }

  const dto = await apiRequest<InventoryLotDto>(`/org/numbatrak/products/${input.product_id}/receive-stock`, {
    method: "POST",
    body: {
      variantId: input.variant_id ?? null,
      quantityRemaining: input.quantity_remaining,
      unitCost: input.unit_cost,
      receivedAt: input.received_at,
    },
  });

  return {
    id: dto.id,
    organization_id: dto.organizationId,
    product_id: dto.productId,
    variant_id: dto.variantId,
    quantity_remaining: dto.quantityRemaining,
    unit_cost: Number(dto.unitCost),
    received_at: dto.receivedAt,
  };
}

/**
 * @deprecated Per-lot FIFO breakdown isn't exposed by the ported backend yet
 * (only the summed stock_on_hand total, via fetchProductsWithDetails) - no
 * ported UI reads individual lots. Kept for signature compatibility.
 */
export async function fetchInventoryLotsByProduct(
  _organizationId: string,
  _productId: string
): Promise<InventoryLot[]> {
  return [];
}

/**
 * @deprecated Superseded by stock_on_hand on fetchProductsWithDetails' rows
 * - kept for signature compatibility with any not-yet-repointed caller.
 */
export async function fetchInventoryLotsSummaryByProduct(
  organizationId: string,
  productIds?: string[]
): Promise<Record<string, { quantity: number; lotCount: number }>> {
  const { fetchProductsWithDetails } = await import("./products");
  const products = await fetchProductsWithDetails(organizationId);
  const result: Record<string, { quantity: number; lotCount: number }> = {};
  for (const p of products) {
    if (productIds && !productIds.includes(p.id)) continue;
    result[p.id] = { quantity: p.stock_on_hand ?? 0, lotCount: 0 };
  }
  return result;
}
