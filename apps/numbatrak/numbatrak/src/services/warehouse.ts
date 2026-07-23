"use client";

import { apiRequest } from "../lib/apiClient";
import { fetchAgents } from "./agents";
import type { Agent } from "../types/agent";

/**
 * Ensure the org has exactly one warehouse agent (HQ stock holder).
 * Safe to call before waybills / transfer flows.
 */
export async function ensureWarehouseAgent(
  _organizationId: string
): Promise<Agent> {
  return apiRequest<Agent>("/org/numbatrak/agents/ensure-warehouse", {
    method: "POST",
  });
}

export async function getWarehouseAgent(
  organizationId: string
): Promise<Agent | null> {
  const agents = await fetchAgents(organizationId);
  return agents.find((a) => a.is_warehouse) ?? null;
}
