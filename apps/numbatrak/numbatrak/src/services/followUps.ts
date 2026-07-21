"use client";

import { supabase } from "../supabaseClient";
import { getDisplayName } from "../utils/userDisplay";
import { FollowUpWithRelations, FollowUpStatus, FollowUpPriority, FollowUpOutcome } from "../types/followUp";
import { calculateWorkHoursMinutes } from "../utils/workHours";
import {
  activeStatusFilterValues,
  normalizeFollowUpStatus,
} from "../utils/followUpStatus";
import { emptyWithoutOrg } from "./orgQuery";

type UserProfileSummary = {
  id: string;
  email: string | null;
  full_name: string | null;
};

/** Batch-load profiles for follow-up assignees (no FK from follow_ups → user_profiles in PostgREST). */
async function fetchUserProfileMap(
  userIds: (string | null | undefined)[]
): Promise<Map<string, UserProfileSummary>> {
  const unique = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (!unique.length) return new Map();

  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, email, full_name")
    .in("id", unique);

  if (error) throw error;

  return new Map((data || []).map((profile) => [profile.id, profile]));
}

function mapFollowUpRow(
  row: Record<string, unknown>,
  profile?: UserProfileSummary | null
): FollowUpWithRelations {
  const validOutcomes: FollowUpOutcome[] = [
    "converted",
    "not_converted",
    "not_interested",
    "follow_up_needed",
    "resolved",
    "other",
  ];

  let outcome: FollowUpOutcome | null = row.outcome as FollowUpOutcome | null;
  if (outcome && !validOutcomes.includes(outcome)) {
    outcome = null;
  }

  const order = row.order as Record<string, unknown> | null | undefined;
  const cart = row.abandoned_cart as Record<string, unknown> | null | undefined;

  return {
    id: row.id as number,
    order_id: row.order_id as string | null,
    abandoned_cart_id: row.abandoned_cart_id as string | null,
    assigned_to: row.assigned_to as string | null,
    status: normalizeFollowUpStatus(String(row.status)),
    priority: row.priority as FollowUpPriority,
    started_at: row.started_at as string | null,
    first_contact_at: row.first_contact_at as string | null,
    completed_at: row.completed_at as string | null,
    response_time_minutes: row.response_time_minutes as number | null,
    resolution_time_minutes: row.resolution_time_minutes as number | null,
    outcome,
    notes: row.notes as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    assigned_user_name: profile
      ? getDisplayName(profile, "Unnamed CSR")
      : null,
    assigned_user_email: profile?.email ?? null,
    order_customer_name: (order?.customer_name as string) ?? null,
    order_customer_phone: (order?.customer_phone as string) ?? null,
    order_customer_location: null,
    cart_customer_name: (cart?.customer_name as string) ?? null,
    cart_customer_phone: (cart?.phone_number as string) ?? null,
    cart_customer_whatsapp: (cart?.whatsapp_number as string) ?? null,
    cart_customer_location: (cart?.location as string) ?? null,
    cart_customer_address: (cart?.delivery_address as string) ?? null,
    cart_customer_state: (cart?.state as string) ?? null,
  };
}

const FOLLOW_UP_RELATIONS_SELECT = `
  *,
  order:orders(id, customer_name, customer_phone),
  abandoned_cart:abandoned_carts(id, customer_name, phone_number, whatsapp_number, location, delivery_address, state, abandoned_at, created_at)
`;

async function getFollowUpSourceAnchor(
  followUp: Pick<FollowUpWithRelations, "order_id" | "abandoned_cart_id">
): Promise<string | null> {
  if (followUp.order_id) {
    const { data: order } = await supabase
      .from("orders")
      .select("created_at, order_date")
      .eq("id", followUp.order_id)
      .single();
    return order?.created_at || order?.order_date || null;
  }

  if (followUp.abandoned_cart_id) {
    const { data: cart } = await supabase
      .from("abandoned_carts")
      .select("abandoned_at, created_at")
      .eq("id", followUp.abandoned_cart_id)
      .single();
    return cart?.abandoned_at || cart?.created_at || null;
  }

  return null;
}

/**
 * Fetch all follow-ups with pagination and filters (org-scoped)
 */
export async function fetchFollowUps(
  organizationId: string | null,
  offset: number = 0,
  limit: number = 20,
  sortOrder: "asc" | "desc" = "desc",
  filters?: {
    assigned_to?: string;
    status?: FollowUpStatus;
    priority?: FollowUpPriority;
    order_id?: string;
    abandoned_cart_id?: string;
    dateFrom?: string;
    dateTo?: string;
  },
  searchQuery?: string
): Promise<FollowUpWithRelations[]> {
  const empty = emptyWithoutOrg<FollowUpWithRelations>(organizationId);
  if (empty) return empty;

  let query = supabase
    .from("follow_ups")
    .select(FOLLOW_UP_RELATIONS_SELECT)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: sortOrder === "asc" })
    .range(offset, offset + limit - 1);

  // Apply search query if provided (notes only — profile names enriched client-side)
  if (searchQuery && searchQuery.trim()) {
    query = query.ilike("notes", `%${searchQuery.trim()}%`);
  }

  // Apply filters
  if (filters?.assigned_to) {
    query = query.eq("assigned_to", filters.assigned_to);
  }
  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.priority) {
    query = query.eq("priority", filters.priority);
  }
  if (filters?.order_id) {
    query = query.eq("order_id", filters.order_id);
  }
  if (filters?.abandoned_cart_id) {
    query = query.eq("abandoned_cart_id", filters.abandoned_cart_id);
  }
  if (filters?.dateFrom) {
    query = query.gte("created_at", filters.dateFrom);
  }
  if (filters?.dateTo) {
    query = query.lte("created_at", filters.dateTo);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const rows = data || [];
  const profileMap = await fetchUserProfileMap(rows.map((row) => row.assigned_to));

  let results = rows.map((row) =>
    mapFollowUpRow(row, profileMap.get(row.assigned_to ?? "") ?? null)
  );

  // Client-side filter: customer names, phones, assignee names
  if (searchQuery && searchQuery.trim()) {
    const searchLower = searchQuery.toLowerCase().trim();
    results = results.filter((followUp) => {
      const assigneeMatch =
        followUp.assigned_user_name?.toLowerCase().includes(searchLower) ||
        followUp.assigned_user_email?.toLowerCase().includes(searchLower);
      const orderCustomerMatch =
        followUp.order_customer_name?.toLowerCase().includes(searchLower) ||
        followUp.order_customer_phone?.toLowerCase().includes(searchLower);
      const cartCustomerMatch =
        followUp.cart_customer_name?.toLowerCase().includes(searchLower) ||
        followUp.cart_customer_phone?.toLowerCase().includes(searchLower) ||
        followUp.cart_customer_whatsapp?.toLowerCase().includes(searchLower);

      return (
        assigneeMatch ||
        orderCustomerMatch ||
        cartCustomerMatch ||
        followUp.notes?.toLowerCase().includes(searchLower)
      );
    });
  }

  return results;
}

/**
 * Get total count of follow-ups
 */
export async function fetchFollowUpsCount(
  organizationId: string | null,
  filters?: {
    assigned_to?: string;
    status?: FollowUpStatus;
    priority?: FollowUpPriority;
    dateFrom?: string;
    dateTo?: string;
  },
  searchQuery?: string
): Promise<number> {
  if (!organizationId) return 0;

  let query = supabase
    .from("follow_ups")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  // Apply search query if provided
  if (searchQuery && searchQuery.trim()) {
    query = query.or(
      `notes.ilike.%${searchQuery}%`
    );
  }

  if (filters?.assigned_to) {
    query = query.eq("assigned_to", filters.assigned_to);
  }
  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.priority) {
    query = query.eq("priority", filters.priority);
  }
  if (filters?.dateFrom) {
    query = query.gte("created_at", filters.dateFrom);
  }
  if (filters?.dateTo) {
    query = query.lte("created_at", filters.dateTo);
  }

  const { count, error } = await query;

  if (error) {
    throw error;
  }

  return count || 0;
}

/**
 * Auto-assign follow-up to least busy Customer Relations rep
 */
async function autoAssignFollowUp(organizationId: string): Promise<string | null> {
  const { data: members, error } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("role", "Customer Relations");

  if (error || !members?.length) {
    return null;
  }

  const userWorkloads = await Promise.all(
    members.map(async (member) => {
      const { count } = await supabase
        .from("follow_ups")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("assigned_to", member.user_id)
        .in("status", activeStatusFilterValues());

      return {
        user_id: member.user_id,
        workload: count || 0,
      };
    })
  );

  // Sort by workload (ascending) and return least busy user
  userWorkloads.sort((a, b) => a.workload - b.workload);
  return userWorkloads[0]?.user_id || null;
}

/**
 * Create a new follow-up with auto-assignment
 */
export async function createFollowUp(input: {
  organization_id: string;
  order_id?: string | null;
  abandoned_cart_id?: string | null;
  assigned_to?: string | null; // If not provided, will auto-assign
  priority?: FollowUpPriority;
  notes?: string | null;
}): Promise<FollowUpWithRelations> {
  let assignedTo = input.assigned_to;
  if (!assignedTo) {
    assignedTo = await autoAssignFollowUp(input.organization_id);
    if (!assignedTo) {
      throw new Error("No Customer Relations users available for assignment");
    }
  }

  const followUpData = {
    organization_id: input.organization_id,
    order_id: input.order_id || null,
    abandoned_cart_id: input.abandoned_cart_id || null,
    assigned_to: assignedTo,
    status: "awaiting" as FollowUpStatus,
    priority: input.priority || ("medium" as FollowUpPriority),
    started_at: null,
    notes: input.notes || null,
  };

  const { data, error } = await supabase
    .from("follow_ups")
    .insert([followUpData])
    .select(FOLLOW_UP_RELATIONS_SELECT)
    .single();

  if (error) {
    throw error;
  }

  const profileMap = await fetchUserProfileMap([data.assigned_to]);
  return mapFollowUpRow(data, profileMap.get(data.assigned_to ?? "") ?? null);
}

/**
 * Update follow-up status and calculate metrics
 */
export async function updateFollowUp(
  id: number,
  updates: {
    status?: FollowUpStatus;
    priority?: FollowUpPriority;
    first_contact_at?: string | null;
    completed_at?: string | null;
    outcome?: FollowUpOutcome | null;
    notes?: string | null;
    assigned_to?: string | null;
  }
): Promise<FollowUpWithRelations> {
  // Get current follow-up to calculate metrics
  const { data: current } = await supabase
    .from("follow_ups")
    .select("*")
    .eq("id", id)
    .single();

  if (!current) {
    throw new Error("Follow-up not found");
  }

  // Calculate response time when CSR first contacts (cart/order landing → first contact)
  let responseTimeMinutes: number | null = current.response_time_minutes;
  const movingToFollowedUp =
    updates.status === "followed_up" ||
    (updates.first_contact_at != null && !current.first_contact_at);

  if (movingToFollowedUp || updates.first_contact_at) {
    const firstContactAt =
      updates.first_contact_at ||
      (updates.status === "followed_up" ? new Date().toISOString() : null) ||
      current.first_contact_at;

    if (firstContactAt) {
      const sourceCreatedAt = await getFollowUpSourceAnchor(current);
      if (sourceCreatedAt) {
        responseTimeMinutes = calculateWorkHoursMinutes(
          new Date(sourceCreatedAt),
          new Date(firstContactAt)
        );
      }
    }
  }

  // Resolution time: first CSR action → resolved
  let resolutionTimeMinutes: number | null = current.resolution_time_minutes;
  const movingToResolved =
    updates.status === "resolved" ||
    (updates.completed_at != null && !current.completed_at);

  if (movingToResolved) {
    const completedAt = updates.completed_at || new Date().toISOString();
    const startedAt =
      current.started_at ||
      current.first_contact_at ||
      current.created_at;

    if (startedAt) {
      resolutionTimeMinutes = calculateWorkHoursMinutes(
        new Date(startedAt),
        new Date(completedAt)
      );
    }
  }

  let firstContactAt = updates.first_contact_at ?? current.first_contact_at;
  if (updates.status === "followed_up" && !firstContactAt) {
    firstContactAt = new Date().toISOString();
  }

  let startedAt = current.started_at;
  if (updates.status === "followed_up" && !startedAt) {
    startedAt = firstContactAt || new Date().toISOString();
  }

  const updateData: Record<string, unknown> = {
    ...updates,
    response_time_minutes: responseTimeMinutes,
    resolution_time_minutes: resolutionTimeMinutes,
  };

  if (firstContactAt) {
    updateData.first_contact_at = firstContactAt;
  }
  if (startedAt) {
    updateData.started_at = startedAt;
  }

  if (updates.status === "resolved" && !updateData.completed_at && !current.completed_at) {
    updateData.completed_at = new Date().toISOString();
  }

  if (updates.status === "resolved" && updates.outcome == null && current.outcome == null) {
    throw new Error("Resolved follow-ups require an outcome (converted or not converted).");
  }

  const { data, error } = await supabase
    .from("follow_ups")
    .update(updateData)
    .eq("id", id)
    .select(FOLLOW_UP_RELATIONS_SELECT)
    .single();

  if (error) {
    throw error;
  }

  const profileMap = await fetchUserProfileMap([data.assigned_to]);
  return mapFollowUpRow(data, profileMap.get(data.assigned_to ?? "") ?? null);
}

/**
 * Delete a follow-up
 */
export async function removeFollowUp(id: number): Promise<void> {
  const { error } = await supabase.from("follow_ups").delete().eq("id", id);

  if (error) {
    throw error;
  }
}

/**
 * Get follow-ups for a specific order
 */
export async function getFollowUpsForOrder(
  organizationId: string,
  orderId: string
): Promise<FollowUpWithRelations[]> {
  return fetchFollowUps(organizationId, 0, 100, "desc", { order_id: orderId });
}

/**
 * Get follow-ups for a specific abandoned cart
 */
export async function getFollowUpsForCart(
  organizationId: string,
  cartId: string
): Promise<FollowUpWithRelations[]> {
  return fetchFollowUps(organizationId, 0, 100, "desc", {
    abandoned_cart_id: cartId,
  });
}

/**
 * Close open follow-ups when an abandoned cart converts to an order.
 */
export async function resolveFollowUpsForConvertedCart(
  organizationId: string,
  cartId: string,
  customerOrderId?: string
): Promise<void> {
  const openFollowUps = await fetchFollowUps(organizationId, 0, 100, "desc", {
    abandoned_cart_id: cartId,
  });

  const active = openFollowUps.filter(
    (fu) => fu.status === "awaiting" || fu.status === "followed_up"
  );

  await Promise.all(
    active.map((fu) =>
      updateFollowUp(fu.id, {
        status: "resolved",
        completed_at: new Date().toISOString(),
        outcome: "converted",
        notes: [
          fu.notes,
          customerOrderId
            ? `Cart converted to order ${customerOrderId}.`
            : "Cart converted to order.",
        ]
          .filter(Boolean)
          .join(" "),
      })
    )
  );
}

