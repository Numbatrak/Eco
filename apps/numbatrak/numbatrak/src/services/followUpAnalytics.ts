"use client";

import { supabase } from "../supabaseClient";
import { FollowUpMetrics, FollowUpAnalytics } from "../types/followUp";
import { meetsSLA } from "../utils/workHours";
import { getDisplayName } from "../utils/userDisplay";
import { statusMatchesBucket } from "../utils/followUpStatus";

const EMPTY_ANALYTICS: FollowUpAnalytics = {
  total_follow_ups: 0,
  awaiting_count: 0,
  followed_up_count: 0,
  resolved_count: 0,
  cancelled_count: 0,
  overall_avg_response_time_minutes: null,
  overall_avg_resolution_time_minutes: null,
  overall_sla_compliance_rate: 0,
  rep_metrics: [],
  response_time_trends: [],
};

/**
 * Fetch analytics data for follow-ups
 */
export async function fetchFollowUpAnalytics(
  organizationId: string | null,
  dateFrom?: string,
  dateTo?: string,
  repId?: string
): Promise<FollowUpAnalytics> {
  if (!organizationId) {
    return EMPTY_ANALYTICS;
  }

  let query = supabase
    .from("follow_ups")
    .select("*")
    .eq("organization_id", organizationId);

  if (dateFrom) {
    query = query.gte("created_at", dateFrom);
  }
  if (dateTo) {
    query = query.lte("created_at", dateTo);
  }
  if (repId) {
    query = query.eq("assigned_to", repId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const followUps = data || [];

  const assigneeIds = [
    ...new Set(
      followUps
        .map((f) => f.assigned_to)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const profileMap = new Map<string, { email: string | null; full_name: string | null }>();
  if (assigneeIds.length) {
    const { data: profiles, error: profileError } = await supabase
      .from("user_profiles")
      .select("id, email, full_name")
      .in("id", assigneeIds);

    if (profileError) {
      throw profileError;
    }

    (profiles || []).forEach((profile) => {
      profileMap.set(profile.id, {
        email: profile.email,
        full_name: profile.full_name,
      });
    });
  }

  const totalFollowUps = followUps.length;
  const awaitingCount = followUps.filter((f) =>
    statusMatchesBucket(f.status, "awaiting")
  ).length;
  const followedUpCount = followUps.filter((f) =>
    statusMatchesBucket(f.status, "followed_up")
  ).length;
  const resolvedCount = followUps.filter((f) =>
    statusMatchesBucket(f.status, "resolved")
  ).length;
  const cancelledCount = followUps.filter((f) =>
    statusMatchesBucket(f.status, "cancelled")
  ).length;

  const responseTimes = followUps
    .map((f) => f.response_time_minutes)
    .filter((t): t is number => t !== null && t !== undefined);
  const overallAvgResponseTime =
    responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : null;

  const resolutionTimes = followUps
    .map((f) => f.resolution_time_minutes)
    .filter((t): t is number => t !== null && t !== undefined);
  const overallAvgResolutionTime =
    resolutionTimes.length > 0
      ? Math.round(resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length)
      : null;

  const slaCompliant = responseTimes.filter((t) => meetsSLA(t)).length;
  const overallSlaComplianceRate =
    responseTimes.length > 0 ? (slaCompliant / responseTimes.length) * 100 : 0;

  const repMap = new Map<string, typeof followUps>();
  followUps.forEach((fu) => {
    if (fu.assigned_to) {
      if (!repMap.has(fu.assigned_to)) {
        repMap.set(fu.assigned_to, []);
      }
      repMap.get(fu.assigned_to)!.push(fu);
    }
  });

  const repMetrics: FollowUpMetrics[] = Array.from(repMap.entries()).map(
    ([repIdKey, repsFollowUps]) => {
      const rep = profileMap.get(repIdKey);
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

      const uniqueOrders = new Set(
        repsFollowUps.map((f) => f.order_id).filter((id) => id !== null)
      );
      const uniqueCarts = new Set(
        repsFollowUps.map((f) => f.abandoned_cart_id).filter((id) => id !== null)
      );
      const customersRespondedTo = uniqueOrders.size + uniqueCarts.size;

      return {
        rep_id: repIdKey,
        rep_name: getDisplayName(
          { full_name: rep?.full_name, email: rep?.email },
          "Unnamed CSR"
        ),
        rep_email: rep?.email || "",
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
      };
    }
  );

  const trendsMap = new Map<string, { count: number; responseTimes: number[] }>();
  followUps.forEach((fu) => {
    if (fu.created_at) {
      const date = new Date(fu.created_at).toISOString().split("T")[0];
      if (!trendsMap.has(date)) {
        trendsMap.set(date, { count: 0, responseTimes: [] });
      }
      const trend = trendsMap.get(date)!;
      trend.count++;
      if (fu.response_time_minutes !== null) {
        trend.responseTimes.push(fu.response_time_minutes);
      }
    }
  });

  const responseTimeTrends = Array.from(trendsMap.entries())
    .map(([date, trendData]) => ({
      date,
      avg_response_time_minutes:
        trendData.responseTimes.length > 0
          ? Math.round(
              trendData.responseTimes.reduce((a, b) => a + b, 0) /
                trendData.responseTimes.length
            )
          : null,
      count: trendData.count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    total_follow_ups: totalFollowUps,
    awaiting_count: awaitingCount,
    followed_up_count: followedUpCount,
    resolved_count: resolvedCount,
    cancelled_count: cancelledCount,
    overall_avg_response_time_minutes: overallAvgResponseTime,
    overall_avg_resolution_time_minutes: overallAvgResolutionTime,
    overall_sla_compliance_rate: overallSlaComplianceRate,
    rep_metrics: repMetrics,
    response_time_trends: responseTimeTrends,
  };
}
