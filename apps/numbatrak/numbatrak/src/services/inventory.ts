"use client";

import { supabase } from "../supabaseClient";
import {
  Inventory,
  InventoryWithRelations,
  InventorySummary,
} from "../types/inventory";
import { emptyWithoutOrg } from "./orgQuery";

/**
 * Read all inventory from the database with relations (filtered by organization)
 */
export async function fetchInventory(
  organizationId: string | null = null
): Promise<InventoryWithRelations[]> {
  const empty = emptyWithoutOrg<InventoryWithRelations>(organizationId);
  if (empty) return empty;

  let query = supabase.from("inventory").select("*").eq("organization_id", organizationId);

  const { data: inventory, error } = await query
    .order("agent_id", { ascending: true, nullsFirst: true })
    .order("product_id", { ascending: true });

  if (error) {
    throw error;
  }

  if (!inventory || inventory.length === 0) {
    return [];
  }

  // Get unique agent and product IDs
  const agentIds = [...new Set(inventory.map((inv: any) => inv.agent_id).filter(Boolean))];
  const productIds = [...new Set(inventory.map((inv: any) => inv.product_id).filter(Boolean))];

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
    (agentsResult.data || []).map((a: any) => [Number(a.id), { id: Number(a.id), name: a.name }])
  );
  const productsMap = new Map(
    (productsResult.data || []).map((p: any) => [
      String(p.id),
      { id: String(p.id), name: p.name },
    ])
  );

  // Map inventory with relations
  return inventory.map((row: any) => ({
    id: Number(row.id),
    agent_id: row.agent_id ? Number(row.agent_id) : null,
    product_id: String(row.product_id),
    total_quantity: Number(row.total_quantity),
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    agent: row.agent_id ? agentsMap.get(Number(row.agent_id)) || null : null,
    product: row.product_id
      ? productsMap.get(String(row.product_id)) || null
      : null,
  }));
}

/**
 * Get inventory summary with delivered quantities calculated from deliveries
 */
export async function fetchInventorySummary(
  organizationId: string | null = null
): Promise<InventorySummary[]> {
  const empty = emptyWithoutOrg<InventorySummary>(organizationId);
  if (empty) return empty;

  const inventory = await fetchInventory(organizationId);

  let agentsQuery = supabase
    .from("agents")
    .select("id, name")
    .eq("organization_id", organizationId)
    .order("name");
  let productsQuery = supabase
    .from("products")
    .select("id, name")
    .eq("organization_id", organizationId)
    .order("name");
  let deliveriesQuery = supabase
    .from("deliveries")
    .select("agent_id, product_id, quantity, status")
    .eq("organization_id", organizationId)
    .eq("status", "Delivered");

  // Fetch all agents and products to ensure we show all combinations
  const { data: agentsData } = await agentsQuery;
  const { data: productsData } = await productsQuery;

  // Fetch all deliveries to calculate delivered quantities
  const { data: deliveries, error: deliveryError } = await deliveriesQuery;

  if (deliveryError) {
    throw deliveryError;
  }

  // Calculate delivered quantities per agent and product
  const deliveredMap = new Map<string, number>();
  deliveries?.forEach((delivery: any) => {
    const key = `${delivery.agent_id || "null"}_${delivery.product_id}`;
    const current = deliveredMap.get(key) || 0;
    deliveredMap.set(key, current + Number(delivery.quantity));
  });

  // Create a map of inventory by agent and product
  const inventoryMap = new Map<string, number>();
  inventory.forEach((inv) => {
    const key = `${inv.agent_id || "null"}_${inv.product_id}`;
    inventoryMap.set(key, inv.total_quantity);
  });

  // Create summaries for all agents (including those with no inventory)
  const agentMap = new Map<number | null, InventorySummary>();

  // Initialize all agents
  agentsData?.forEach((agent: any) => {
    agentMap.set(agent.id, {
      agent_id: agent.id,
      agent_name: agent.name,
      products: [],
    });
  });

  // Add products to each agent
  agentMap.forEach((summary, agentId) => {
    productsData?.forEach((product: any) => {
      const key = `${agentId || "null"}_${product.id}`;
      const total = inventoryMap.get(key) || 0;
      const delivered = deliveredMap.get(key) || 0;
      const remaining = Math.max(0, total - delivered);

      summary.products.push({
        product_id: product.id,
        product_name: product.name,
        total: total,
        delivered: delivered,
        remaining: remaining,
      });
    });
  });

  // Convert to array and sort
  const summaries = Array.from(agentMap.values());
  summaries.sort((a, b) => {
    if (a.agent_id === null && b.agent_id !== null) return 1;
    if (a.agent_id !== null && b.agent_id === null) return -1;
    if (a.agent_id === null && b.agent_id === null) return 0;
    return (a.agent_name || "").localeCompare(b.agent_name || "");
  });

  return summaries;
}

/**
 * Insert or update inventory
 */
export async function upsertInventory(input: {
  agent_id?: number | null;
  /** `products.id` (UUID) */
  product_id: string;
  total_quantity: number;
  organization_id: string;
}): Promise<Inventory> {
  const { data, error } = await supabase
    .from("inventory")
    .upsert(
      [
        {
          agent_id: input.agent_id || null,
          product_id: input.product_id,
          total_quantity: input.total_quantity,
          organization_id: input.organization_id,
          updated_at: new Date().toISOString(),
        },
      ],
      {
        onConflict: "agent_id,product_id,organization_id",
      }
    )
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("No data returned from upsert");
  }

  return {
    id: Number(data.id),
    agent_id: data.agent_id ? Number(data.agent_id) : null,
    product_id: String(data.product_id),
    total_quantity: Number(data.total_quantity),
    created_at: data.created_at ?? null,
    updated_at: data.updated_at ?? null,
  };
}

/**
 * Delete inventory entry
 */
export async function removeInventory(inventoryId: number): Promise<void> {
  const { error } = await supabase
    .from("inventory")
    .delete()
    .eq("id", inventoryId);
  if (error) {
    throw error;
  }
}

/**
 * Delete inventory by agent and product
 */
export async function removeInventoryByAgentAndProduct(
  organizationId: string,
  agentId: number | null,
  productId: string
): Promise<void> {
  const { error } = await supabase
    .from("inventory")
    .delete()
    .eq("organization_id", organizationId)
    .eq("agent_id", agentId)
    .eq("product_id", productId);
  if (error) {
    throw error;
  }
}

/**
 * Transfer inventory from one agent to another
 */
export async function transferInventory(input: {
  from_agent_id: number;
  to_agent_id: number;
  /** `products.id` (UUID) */
  product_id: string;
  quantity: number;
  organization_id: string;
}): Promise<void> {
  // First, check if source agent has enough inventory
  const { data: sourceInventory, error: sourceError } = await supabase
    .from("inventory")
    .select("*")
    .eq("agent_id", input.from_agent_id)
    .eq("product_id", input.product_id)
    .eq("organization_id", input.organization_id)
    .single();

  if (sourceError && sourceError.code !== "PGRST116") {
    // PGRST116 is "not found" error, which is expected if inventory doesn't exist
    throw sourceError;
  }

  if (!sourceInventory || sourceInventory.total_quantity < input.quantity) {
    throw new Error(
      `Insufficient inventory. Available: ${
        sourceInventory?.total_quantity || 0
      }, Requested: ${input.quantity}`
    );
  }

  // Calculate new quantities
  const newSourceQuantity = sourceInventory.total_quantity - input.quantity;

  // Get destination inventory (if exists)
  const { data: destInventory, error: destError } = await supabase
    .from("inventory")
    .select("*")
    .eq("agent_id", input.to_agent_id)
    .eq("product_id", input.product_id)
    .eq("organization_id", input.organization_id)
    .single();

  if (destError && destError.code !== "PGRST116") {
    throw destError;
  }

  const newDestQuantity = (destInventory?.total_quantity || 0) + input.quantity;

  // Perform the transfer in a transaction-like manner
  // Update source inventory
  if (newSourceQuantity > 0) {
    const { error: updateSourceError } = await supabase
      .from("inventory")
      .update({
        total_quantity: newSourceQuantity,
        updated_at: new Date().toISOString(),
      })
      .eq("agent_id", input.from_agent_id)
      .eq("product_id", input.product_id)
      .eq("organization_id", input.organization_id);

    if (updateSourceError) {
      throw updateSourceError;
    }
  } else {
    // If quantity becomes 0, delete the inventory entry
    const { error: deleteSourceError } = await supabase
      .from("inventory")
      .delete()
      .eq("agent_id", input.from_agent_id)
      .eq("product_id", input.product_id)
      .eq("organization_id", input.organization_id);

    if (deleteSourceError) {
      throw deleteSourceError;
    }
  }

  // Update or create destination inventory
  const { error: upsertDestError } = await supabase.from("inventory").upsert(
    [
      {
        agent_id: input.to_agent_id,
        product_id: input.product_id,
        total_quantity: newDestQuantity,
        organization_id: input.organization_id,
        updated_at: new Date().toISOString(),
      },
    ],
    {
      onConflict: "agent_id,product_id,organization_id",
    }
  );

  if (upsertDestError) {
    throw upsertDestError;
  }
}
