"use client";

import { supabase } from "../supabaseClient";
import { UserProfile } from "../types/user";
import { fetchOrganizationMembers } from "./organizations";

/**
 * Fetch Customer Relations users in the current organization (org role, not global profile role).
 */
export async function fetchCustomerRelationsUsers(
  organizationId: string | null
): Promise<UserProfile[]> {
  if (!organizationId) return [];

  const members = await fetchOrganizationMembers(organizationId);
  const crMembers = members.filter((m) => m.role === "Customer Relations");
  if (!crMembers.length) return [];

  const userIds = crMembers.map((m) => m.user_id);
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, email, full_name, role, created_at, updated_at")
    .in("id", userIds)
    .order("full_name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map((profile) => ({
    id: profile.id,
    email: profile.email || null,
    full_name: profile.full_name ?? null,
    role: profile.role,
    created_at: profile.created_at || null,
    updated_at: profile.updated_at || null,
  }));
}
