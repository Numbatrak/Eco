"use client";

import { supabase } from "../supabaseClient";

export type AssignmentMethod = "round_robin" | "percentage";

export interface OrderAssignmentSettings {
  id: string;
  organization_id: string;
  assignment_method: AssignmentMethod;
  last_assigned_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderAssignmentWeight {
  id: string;
  organization_id: string;
  user_id: string;
  percentage: number;
  is_paused: boolean;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    email: string;
    full_name: string | null;
  };
}

async function mapProfilesToUserIds(
  userIds: string[]
): Promise<Map<string, { id: string; email: string; full_name: string | null }>> {
  const unique = [...new Set(userIds)].filter(Boolean);
  const map = new Map<string, { id: string; email: string; full_name: string | null }>();
  if (unique.length === 0) return map;
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, email, full_name")
    .in("id", unique);
  if (error) throw error;
  for (const p of data || []) {
    map.set(p.id, p);
  }
  return map;
}

/**
 * Fetch order assignment settings for an organization
 */
export async function fetchOrderAssignmentSettings(
  organizationId: string
): Promise<OrderAssignmentSettings | null> {
  const { data, error } = await supabase
    .from("order_assignment_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No settings found, return null (will create default)
      return null;
    }
    throw error;
  }

  return data;
}

/**
 * Create or update order assignment settings
 */
export async function upsertOrderAssignmentSettings(
  organizationId: string,
  assignmentMethod: AssignmentMethod,
  lastAssignedUserId?: string | null
): Promise<OrderAssignmentSettings> {
  const { data, error } = await supabase
    .from("order_assignment_settings")
    .upsert(
      {
        organization_id: organizationId,
        assignment_method: assignmentMethod,
        last_assigned_user_id: lastAssignedUserId || null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "organization_id",
      }
    )
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Fetch all assignment weights for an organization with user info
 */
export async function fetchOrderAssignmentWeights(
  organizationId: string
): Promise<OrderAssignmentWeight[]> {
  const { data, error } = await supabase
    .from("order_assignment_weights")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  if (!data?.length) {
    return [];
  }

  const profileMap = await mapProfilesToUserIds(data.map((r) => r.user_id));
  return data.map((row) => {
    const u = profileMap.get(row.user_id);
    return {
      id: row.id,
      organization_id: row.organization_id,
      user_id: row.user_id,
      percentage: Number(row.percentage),
      is_paused: row.is_paused,
      created_at: row.created_at,
      updated_at: row.updated_at,
      user: u
        ? {
            id: u.id,
            email: u.email,
            full_name: u.full_name,
          }
        : undefined,
    };
  });
}

/**
 * Upsert assignment weight for a user
 */
export async function upsertOrderAssignmentWeight(
  organizationId: string,
  userId: string,
  percentage: number,
  isPaused: boolean
): Promise<OrderAssignmentWeight> {
  const { data, error } = await supabase
    .from("order_assignment_weights")
    .upsert(
      {
        organization_id: organizationId,
        user_id: userId,
        percentage: Math.max(0, Math.min(100, percentage)), // Clamp between 0-100
        is_paused: isPaused,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "organization_id,user_id",
      }
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const profileMap = await mapProfilesToUserIds([data.user_id]);
  const u = profileMap.get(data.user_id);
  return {
    id: data.id,
    organization_id: data.organization_id,
    user_id: data.user_id,
    percentage: Number(data.percentage),
    is_paused: data.is_paused,
    created_at: data.created_at,
    updated_at: data.updated_at,
    user: u
      ? {
          id: u.id,
          email: u.email,
          full_name: u.full_name,
        }
      : undefined,
  };
}

/**
 * Delete assignment weight for a user
 */
export async function deleteOrderAssignmentWeight(
  organizationId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from("order_assignment_weights")
    .delete()
    .eq("organization_id", organizationId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}

/**
 * Get next user to assign order to (based on settings)
 */
export async function getNextAssignedUser(
  organizationId: string
): Promise<string | null> {
  // Get assignment settings
  const settings = await fetchOrderAssignmentSettings(organizationId);

  if (!settings) {
    // No settings, use round-robin as default
    const { data, error } = await supabase.rpc("get_next_round_robin_user", {
      org_id: organizationId,
    });

    if (error) {
      console.error("Error getting round-robin user:", error);
      return null;
    }

    return data;
  }

  if (settings.assignment_method === "round_robin") {
    const { data, error } = await supabase.rpc("get_next_round_robin_user", {
      org_id: organizationId,
    });

    if (error) {
      console.error("Error getting round-robin user:", error);
      return null;
    }

    return data;
  } else {
    // Percentage-based assignment
    const { data, error } = await supabase.rpc("get_percentage_assigned_user", {
      org_id: organizationId,
    });

    if (error) {
      console.error("Error getting percentage-assigned user:", error);
      return null;
    }

    return data;
  }
}

