"use client";

import { supabase } from "../supabaseClient";
import { FollowUpMetrics } from "../types/followUp";
import { getDisplayName } from "../utils/userDisplay";
import { meetsSLA } from "../utils/workHours";
import { fetchOrganizationMembers } from "./organizations";
import { statusMatchesBucket } from "../utils/followUpStatus";

export interface CustomerRelationsLeaderboardEntry extends FollowUpMetrics {
  rank: number;
}

/**
 * Fetch all Customer Relations users with their follow-up metrics
 * This includes users even if they have no follow-ups assigned
 */
export async function fetchCustomerRelationsLeaderboard(
  organizationId: string | null,
  dateFrom?: string,
  dateTo?: string
): Promise<CustomerRelationsLeaderboardEntry[]> {
  if (!organizationId) return [];

  const members = await fetchOrganizationMembers(organizationId);
  const crUsers = members
    .filter((m) => m.role === "Customer Relations")
    .map((m) => ({
      id: m.user_id,
      email: m.user?.email ?? null,
      full_name: m.user?.full_name ?? null,
    }));

  if (!crUsers.length) return [];

  const crUserIds = crUsers.map((u) => u.id);

  let followUpsQuery = supabase
    .from("follow_ups")
    .select("*")
    .eq("organization_id", organizationId)
    .in("assigned_to", crUserIds);

  // Apply date filters
  if (dateFrom) {
    followUpsQuery = followUpsQuery.gte("created_at", dateFrom);
  }
  if (dateTo) {
    followUpsQuery = followUpsQuery.lte("created_at", dateTo);
  }

  const { data: followUps, error: followUpsError } = await followUpsQuery;

  if (followUpsError) {
    throw followUpsError;
  }

  const followUpsData = followUps || [];

  // Group follow-ups by rep
  const repMap = new Map<string, any[]>();
  followUpsData.forEach((fu: any) => {
    if (fu.assigned_to) {
      if (!repMap.has(fu.assigned_to)) {
        repMap.set(fu.assigned_to, []);
      }
      repMap.get(fu.assigned_to)!.push(fu);
    }
  });

  // Calculate metrics for each Customer Relations user
  const leaderboard: CustomerRelationsLeaderboardEntry[] = crUsers.map((user: any) => {
    const repsFollowUps = repMap.get(user.id) || [];
    
    const repResponseTimes = repsFollowUps
      .map((f: any) => f.response_time_minutes)
      .filter((t): t is number => t !== null && t !== undefined);
    const repResolutionTimes = repsFollowUps
      .map((f: any) => f.resolution_time_minutes)
      .filter((t): t is number => t !== null && t !== undefined);

    const avgResponseTime =
      repResponseTimes.length > 0
        ? Math.round(repResponseTimes.reduce((a, b) => a + b, 0) / repResponseTimes.length)
        : null;
    const avgResolutionTime =
      repResolutionTimes.length > 0
        ? Math.round(repResolutionTimes.reduce((a, b) => a + b, 0) / repResolutionTimes.length)
        : null;

    const repSlaCompliant = repResponseTimes.filter((t) => meetsSLA(t)).length;
    const slaComplianceRate =
      repResponseTimes.length > 0 ? (repSlaCompliant / repResponseTimes.length) * 100 : 0;

    const cartFollowUps = repsFollowUps.filter((f: any) => f.abandoned_cart_id !== null);
    const closedCartFollowUps = cartFollowUps.filter((f: any) =>
      statusMatchesBucket(f.status, "resolved")
    );
    const converted = closedCartFollowUps.filter(
      (f: any) => f.outcome === "converted"
    ).length;
    const conversionRate =
      closedCartFollowUps.length > 0
        ? (converted / closedCartFollowUps.length) * 100
        : 0;

    // Calculate unique customers/orders responded to
    const uniqueOrders = new Set(repsFollowUps.map((f: any) => f.order_id).filter((id: any) => id !== null));
    const uniqueCarts = new Set(repsFollowUps.map((f: any) => f.abandoned_cart_id).filter((id: any) => id !== null));
    const customersRespondedTo = uniqueOrders.size + uniqueCarts.size;

    return {
      rep_id: user.id,
      rep_name: getDisplayName(user, "Unnamed CSR"),
      rep_email: user.email || "No Email",
      total_follow_ups: repsFollowUps.length,
      awaiting_count: repsFollowUps.filter((f: any) =>
        statusMatchesBucket(f.status, "awaiting")
      ).length,
      followed_up_count: repsFollowUps.filter((f: any) =>
        statusMatchesBucket(f.status, "followed_up")
      ).length,
      resolved_count: repsFollowUps.filter((f: any) =>
        statusMatchesBucket(f.status, "resolved")
      ).length,
      cancelled_count: repsFollowUps.filter((f: any) =>
        statusMatchesBucket(f.status, "cancelled")
      ).length,
      avg_response_time_minutes: avgResponseTime,
      avg_resolution_time_minutes: avgResolutionTime,
      conversion_rate: conversionRate,
      sla_compliance_rate: slaComplianceRate,
      customers_responded_to: customersRespondedTo,
      rank: 0, // Will be set after sorting
    };
  });

  // Sort by performance (SLA compliance rate, then response time, then customers responded to)
  leaderboard.sort((a, b) => {
    // First sort by SLA compliance (higher is better)
    if (a.sla_compliance_rate !== b.sla_compliance_rate) {
      return b.sla_compliance_rate - a.sla_compliance_rate;
    }
    // Then by response time (lower is better, nulls last)
    if (a.avg_response_time_minutes !== null && b.avg_response_time_minutes !== null) {
      if (a.avg_response_time_minutes !== b.avg_response_time_minutes) {
        return a.avg_response_time_minutes - b.avg_response_time_minutes;
      }
    } else if (a.avg_response_time_minutes === null && b.avg_response_time_minutes !== null) {
      return 1;
    } else if (a.avg_response_time_minutes !== null && b.avg_response_time_minutes === null) {
      return -1;
    }
    // Then by customers responded to (higher is better)
    const aCustomers = a.customers_responded_to || 0;
    const bCustomers = b.customers_responded_to || 0;
    if (aCustomers !== bCustomers) {
      return bCustomers - aCustomers;
    }
    // Finally by name
    return a.rep_name.localeCompare(b.rep_name);
  });

  // Assign ranks
  leaderboard.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return leaderboard;
}

