"use client";

import { FollowUpMetrics } from "../types/followUp";
import { getDisplayName } from "../utils/userDisplay";
import { meetsSLA } from "../utils/workHours";
import { fetchCustomerRelationsUsers } from "./customerRelations";
import { fetchFollowUps } from "./followUps";
import { statusMatchesBucket } from "../utils/followUpStatus";

export interface CustomerRelationsLeaderboardEntry extends FollowUpMetrics {
  rank: number;
}

/**
 * Fetch all Customer Relations (csr-role) users with their follow-up
 * metrics - includes users even if they have no follow-ups assigned.
 */
export async function fetchCustomerRelationsLeaderboard(
  organizationId: string | null,
  dateFrom?: string,
  dateTo?: string
): Promise<CustomerRelationsLeaderboardEntry[]> {
  if (!organizationId) return [];

  const crUsers = await fetchCustomerRelationsUsers(organizationId);
  if (!crUsers.length) return [];

  const followUpsData = await fetchFollowUps(organizationId, 0, 2000, "desc", { dateFrom, dateTo });

  const repMap = new Map<string, typeof followUpsData>();
  followUpsData.forEach((fu) => {
    if (fu.assigned_to) {
      if (!repMap.has(fu.assigned_to)) {
        repMap.set(fu.assigned_to, []);
      }
      repMap.get(fu.assigned_to)!.push(fu);
    }
  });

  const leaderboard: CustomerRelationsLeaderboardEntry[] = crUsers.map((user) => {
    const repsFollowUps = repMap.get(user.id) || [];

    const repResponseTimes = repsFollowUps
      .map((f) => f.response_time_minutes)
      .filter((t): t is number => t !== null && t !== undefined);
    const repResolutionTimes = repsFollowUps
      .map((f) => f.resolution_time_minutes)
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

    const cartFollowUps = repsFollowUps.filter((f) => f.abandoned_cart_id !== null);
    const closedCartFollowUps = cartFollowUps.filter((f) =>
      statusMatchesBucket(f.status, "resolved")
    );
    const converted = closedCartFollowUps.filter(
      (f) => f.outcome === "converted"
    ).length;
    const conversionRate =
      closedCartFollowUps.length > 0
        ? (converted / closedCartFollowUps.length) * 100
        : 0;

    const uniqueOrders = new Set(repsFollowUps.map((f) => f.order_id).filter((id) => id !== null));
    const uniqueCarts = new Set(repsFollowUps.map((f) => f.abandoned_cart_id).filter((id) => id !== null));
    const customersRespondedTo = uniqueOrders.size + uniqueCarts.size;

    return {
      rep_id: user.id,
      rep_name: getDisplayName(user, "Unnamed CSR"),
      rep_email: user.email || "No Email",
      total_follow_ups: repsFollowUps.length,
      awaiting_count: repsFollowUps.filter((f) =>
        statusMatchesBucket(f.status, "awaiting")
      ).length,
      followed_up_count: repsFollowUps.filter((f) =>
        statusMatchesBucket(f.status, "followed_up")
      ).length,
      resolved_count: repsFollowUps.filter((f) =>
        statusMatchesBucket(f.status, "resolved")
      ).length,
      cancelled_count: repsFollowUps.filter((f) =>
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
    if (a.sla_compliance_rate !== b.sla_compliance_rate) {
      return b.sla_compliance_rate - a.sla_compliance_rate;
    }
    if (a.avg_response_time_minutes !== null && b.avg_response_time_minutes !== null) {
      if (a.avg_response_time_minutes !== b.avg_response_time_minutes) {
        return a.avg_response_time_minutes - b.avg_response_time_minutes;
      }
    } else if (a.avg_response_time_minutes === null && b.avg_response_time_minutes !== null) {
      return 1;
    } else if (a.avg_response_time_minutes !== null && b.avg_response_time_minutes === null) {
      return -1;
    }
    const aCustomers = a.customers_responded_to || 0;
    const bCustomers = b.customers_responded_to || 0;
    if (aCustomers !== bCustomers) {
      return bCustomers - aCustomers;
    }
    return a.rep_name.localeCompare(b.rep_name);
  });

  leaderboard.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return leaderboard;
}
