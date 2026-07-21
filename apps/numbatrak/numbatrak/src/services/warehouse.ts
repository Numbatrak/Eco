"use client";

import { supabase } from "../supabaseClient";
import { fetchAgents } from "./agents";
import type { Agent } from "../types/agent";

const WAREHOUSE_NAME = "Warehouse (HQ)";

/**
 * Ensure the org has exactly one warehouse agent (HQ stock holder).
 * Safe to call before waybills / receive-stock flows.
 */
export async function ensureWarehouseAgent(
  organizationId: string
): Promise<Agent> {
  const { data: existing, error: fetchErr } = await supabase
    .from("agents")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_warehouse", true)
    .maybeSingle();

  if (fetchErr && fetchErr.code !== "42703") {
    throw fetchErr;
  }

  if (existing) {
    return mapWarehouseRow(existing);
  }

  const { data: created, error: insertErr } = await supabase
    .from("agents")
    .insert({
      organization_id: organizationId,
      name: WAREHOUSE_NAME,
      locations: "HQ",
      active: true,
      is_warehouse: true,
      can_deliver: false,
    })
    .select("*")
    .single();

  if (insertErr) {
    if (insertErr.code === "42703") {
      throw new Error(
        "Warehouse agent requires migration 20260720140000_inventory_stabilization.sql"
      );
    }
    throw insertErr;
  }

  return mapWarehouseRow(created);
}

export async function getWarehouseAgent(
  organizationId: string
): Promise<Agent | null> {
  const agents = await fetchAgents(organizationId);
  return agents.find((a) => a.is_warehouse) ?? null;
}

function mapWarehouseRow(row: Record<string, unknown>): Agent {
  const locationsRaw = row.locations as string | null;
  return {
    id: Number(row.id),
    name: (row.name as string) ?? WAREHOUSE_NAME,
    locations: locationsRaw
      ? locationsRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : ["HQ"],
    active: row.active !== false,
    is_warehouse: row.is_warehouse === true,
    can_deliver: row.can_deliver !== false,
    created_at: (row.created_at as string | null) ?? null,
  };
}
