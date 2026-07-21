"use client";

import { supabase } from "../supabaseClient";

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

/**
 * Create an inventory lot (receive stock) for FIFO consumption.
 * Orders will consume from lots by received_at ASC.
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

  const { data, error } = await supabase
    .from("inventory_lots")
    .insert([
      {
        organization_id: input.organization_id,
        product_id: input.product_id,
        variant_id: input.variant_id ?? null,
        quantity_remaining: input.quantity_remaining,
        unit_cost: input.unit_cost,
        received_at: input.received_at ?? new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("No data returned from insert");
  }

  return {
    id: data.id,
    organization_id: data.organization_id,
    product_id: data.product_id,
    variant_id: data.variant_id ?? null,
    quantity_remaining: Number(data.quantity_remaining),
    unit_cost: Number(data.unit_cost),
    received_at: data.received_at,
    created_at: data.created_at ?? null,
    updated_at: data.updated_at ?? null,
  };
}

/**
 * Fetch inventory lots for a product (for FIFO display / stock on hand).
 */
export async function fetchInventoryLotsByProduct(
  organizationId: string,
  productId: string
): Promise<InventoryLot[]> {
  const { data, error } = await supabase
    .from("inventory_lots")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("product_id", productId)
    .order("received_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    organization_id: row.organization_id,
    product_id: row.product_id,
    quantity_remaining: Number(row.quantity_remaining),
    unit_cost: Number(row.unit_cost),
    received_at: row.received_at,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  }));
}

/**
 * Fetch total quantity on hand per product (sum of quantity_remaining across lots).
 */
export async function fetchInventoryLotsSummaryByProduct(
  organizationId: string,
  productIds?: string[]
): Promise<Record<string, { quantity: number; lotCount: number }>> {
  let query = supabase
    .from("inventory_lots")
    .select("product_id, quantity_remaining")
    .eq("organization_id", organizationId);

  if (productIds && productIds.length > 0) {
    query = query.in("product_id", productIds);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const summary: Record<string, { quantity: number; lotCount: number }> = {};
  (data || []).forEach((row: any) => {
    const pid = row.product_id;
    if (!summary[pid]) {
      summary[pid] = { quantity: 0, lotCount: 0 };
    }
    summary[pid].quantity += Number(row.quantity_remaining);
    summary[pid].lotCount += 1;
  });
  return summary;
}
