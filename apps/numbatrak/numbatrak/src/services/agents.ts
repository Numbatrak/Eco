"use client";

import { supabase } from "../supabaseClient";
import type { Agent } from "../types/agent";
import { emptyWithoutOrg } from "./orgQuery";

export type { Agent };

export type FetchAgentsOptions = {
  /** When true, only agents with active = true are returned. */
  activeOnly?: boolean;
};

/**
 * Read all agents from the database (filtered by organization)
 */
export async function fetchAgents(
  organizationId: string | null,
  options?: FetchAgentsOptions
): Promise<Agent[]> {
  const empty = emptyWithoutOrg<Agent>(organizationId);
  if (empty) return empty;

  let query = supabase
    .from("agents")
    .select("*")
    .eq("organization_id", organizationId);

  if (options?.activeOnly) {
    query = query.eq("active", true);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  if (!data) {
    return [];
  }

  return data.map((row: Record<string, unknown>) => mapAgentRow(row));
}

function trimOrNull(value: string | null | undefined): string | null {
  const t = value?.trim();
  return t ? t : null;
}

export function normalizeAgentContact(input: {
  contact_person?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
}): {
  contact_person: string | null;
  contact_phone: string | null;
  contact_email: string | null;
} {
  const contact_email = trimOrNull(input.contact_email);
  if (contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email)) {
    throw new Error("Enter a valid email address or leave email blank.");
  }
  return {
    contact_person: trimOrNull(input.contact_person),
    contact_phone: trimOrNull(input.contact_phone),
    contact_email,
  };
}

function mapAgentRow(row: Record<string, unknown>): Agent {
  try {
    return {
      id: Number(row.id),
      name: (row.name as string) ?? "Unknown",
      locations: parseLocations(row.locations as string | null | undefined),
      active: row.active !== false,
      is_warehouse: row.is_warehouse === true,
      can_deliver: row.can_deliver !== false,
      contact_person: (row.contact_person as string | null) ?? null,
      contact_phone: (row.contact_phone as string | null) ?? null,
      contact_email: (row.contact_email as string | null) ?? null,
      created_at: (row.created_at as string | null) ?? null,
    };
  } catch (err) {
    console.error("Error parsing agent row:", row, err);
    return {
      id: Number(row.id) || 0,
      name: (row.name as string) ?? "Unknown",
      locations: [],
      active: row.active !== false,
      is_warehouse: row.is_warehouse === true,
      can_deliver: row.can_deliver !== false,
      contact_person: (row.contact_person as string | null) ?? null,
      contact_phone: (row.contact_phone as string | null) ?? null,
      contact_email: (row.contact_email as string | null) ?? null,
      created_at: (row.created_at as string | null) ?? null,
    };
  }
}

/**
 * Parse locations from text field (comma-separated string)
 */
function parseLocations(locations: string | null | undefined): string[] {
  if (!locations) return [];
  if (Array.isArray(locations)) return locations;
  return locations
    .toString()
    .split(",")
    .map((loc: string) => loc.trim())
    .filter(Boolean);
}

/**
 * Insert a new agent into the database
 */
export async function createAgent(input: {
  name: string;
  locations: string[];
  organization_id: string;
  contact_person?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
}): Promise<Agent> {
  const contact = normalizeAgentContact(input);
  const { data, error } = await supabase
    .from("agents")
    .insert([
      {
        name: input.name,
        locations: input.locations.join(", "),
        organization_id: input.organization_id,
        active: true,
        ...contact,
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

  return mapAgentRow(data);
}

/**
 * Update an existing agent in the database
 */
export async function updateAgent(
  agentId: number,
  input: {
    name: string;
    locations: string[];
    active?: boolean;
    contact_person?: string | null;
    contact_phone?: string | null;
    contact_email?: string | null;
  }
): Promise<Agent> {
  const contact = normalizeAgentContact(input);
  const updateData: Record<string, unknown> = {
    name: input.name,
    locations: input.locations.join(", "),
    ...contact,
  };
  if (input.active !== undefined) {
    updateData.active = input.active;
  }

  const { data, error } = await supabase
    .from("agents")
    .update(updateData)
    .eq("id", agentId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("No data returned from update");
  }

  return mapAgentRow(data);
}

/**
 * Activate or deactivate an agent without deleting history.
 */
export async function setAgentActive(
  agentId: number,
  active: boolean
): Promise<Agent> {
  const { data, error } = await supabase
    .from("agents")
    .update({ active })
    .eq("id", agentId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("No data returned from update");
  }

  return mapAgentRow(data);
}

/**
 * Delete an agent from the database
 */
export async function removeAgent(agentId: number): Promise<void> {
  const { error } = await supabase.from("agents").delete().eq("id", agentId);
  if (error) {
    throw error;
  }
}
