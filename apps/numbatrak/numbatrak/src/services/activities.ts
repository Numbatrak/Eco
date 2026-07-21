"use client";

import { supabase } from "../supabaseClient";
import { Activity, ActivityType, EntityType, ActivityWithUser } from "../types/activity";

/**
 * Log an activity to the database
 */
export async function logActivity(input: {
  organizationId: string;
  userId: string;
  userName?: string;
  actionType: ActivityType;
  entityType: EntityType;
  entityId?: number | null;
  description: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    const { error } = await supabase
      .from("activities")
      .insert({
        organization_id: input.organizationId,
        user_id: input.userId,
        user_name: input.userName,
        action_type: input.actionType,
        entity_type: input.entityType,
        entity_id: input.entityId || null,
        description: input.description,
        metadata: input.metadata || null,
      });

    if (error) {
      console.error("Error logging activity:", error);
      // Don't throw - activity logging should not break the main flow
    }
  } catch (error) {
    console.error("Error logging activity:", error);
    // Don't throw - activity logging should not break the main flow
  }
}

/**
 * Fetch activities for the current organization
 * Only Owners and Admins can view activities
 */
export async function fetchActivities(
  organizationId: string | null,
  limit: number = 50
): Promise<ActivityWithUser[]> {
  if (!organizationId) {
    return [];
  }

  const { data, error } = await supabase
    .from("activities")
    .select(`
      *,
      user:user_profiles (
        id,
        email,
        full_name
      )
    `)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (error.code === "42P01" || error.message?.includes("schema cache")) {
      console.warn("activities table missing. Run migration 20260612120000");
      return [];
    }
    console.error("Error fetching activities:", error);
    throw error;
  }

  if (!data) {
    return [];
  }

  return data.map((row: any) => ({
    id: row.id,
    organization_id: row.organization_id,
    user_id: row.user_id,
    user_name: row.user_name,
    action_type: row.action_type,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    description: row.description,
    metadata: row.metadata,
    created_at: row.created_at,
    user: row.user ? {
      id: row.user.id,
      email: row.user.email,
      full_name: row.user.full_name,
    } : undefined,
  }));
}

/**
 * Format timestamp to relative time (e.g., "2 min ago", "1 hour ago")
 */
export function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now.getTime() - time.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return "just now";
  } else if (diffMins < 60) {
    return `${diffMins} min${diffMins === 1 ? "" : "s"} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  } else {
    return time.toLocaleDateString();
  }
}

/**
 * Get activity icon type based on action type
 */
export function getActivityIconType(actionType: ActivityType): 'reminder' | 'breach' | 'award' | 'alert' | 'success' {
  if (actionType.includes('created')) return 'success';
  if (actionType.includes('updated')) return 'reminder';
  if (actionType.includes('deleted')) return 'breach';
  if (actionType.includes('completed') || actionType.includes('converted')) return 'award';
  return 'alert';
}

