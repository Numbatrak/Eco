"use client";

// Split out of services/dashboard.ts (which is now ported off Supabase) -
// this function is still Supabase-based and out of scope for this port
// (used only by the not-yet-ported Delivery Analytics / Waybill Statistics
// page, components/waybillStatistics/WaybillStatisticsTable.tsx). Keeping it
// in its own file means importing it doesn't re-poison the now-clean
// services/dashboard.ts for the actually-ported Dashboard page.
import { supabase } from "../supabaseClient";

/**
 * Waybill statistics by state/region
 */
export interface WaybillByState {
  state: string;
  totalQuantity: number;
  totalCost: number;
  waybillCount: number;
  earliestDate: string | null;
  latestDate: string | null;
  averageDaysSinceWaybill: number | null;
}

/**
 * Get waybill statistics grouped by state/region
 * Filters waybilled items by agent location (excluding Lagos as it's the central warehouse)
 *
 * @param startDate Optional start date filter (ISO string)
 * @param endDate Optional end date filter (ISO string)
 * @param stateFilter Optional state filter (if provided, only returns that state)
 */
export async function fetchWaybillsByState(
  organizationId: string | null,
  startDate?: string,
  endDate?: string,
  stateFilter?: string
): Promise<WaybillByState[]> {
  if (!organizationId) return [];

  try {
    let query = supabase
      .from("deliveries")
      .select("id, date, quantity, cost, status, agent_id")
      .eq("organization_id", organizationId)
      .eq("status", "Waybilled");

    // Apply date filters if provided
    if (startDate) {
      query = query.gte("date", startDate);
    }
    if (endDate) {
      query = query.lte("date", endDate);
    }

    const { data: deliveries, error } = await query.order("date", {
      ascending: false,
    });

    if (error) {
      throw error;
    }

    if (!deliveries || deliveries.length === 0) {
      return [];
    }

    // Fetch agents separately to get locations
    const agentIds = [
      ...new Set(deliveries.map((d: any) => d.agent_id).filter(Boolean)),
    ];
    const agentsResult =
      agentIds.length > 0
        ? await supabase
            .from("agents")
            .select("id, name, locations")
            .in("id", agentIds)
        : { data: [], error: null };

    const agentsMap = new Map(
      (agentsResult.data || []).map((a: any) => [Number(a.id), a])
    );

    // Parse agent locations and group by state
    const stateMap = new Map<
      string,
      {
        totalQuantity: number;
        totalCost: number;
        waybillCount: number;
        dates: string[];
      }
    >();

    const today = new Date();

    deliveries.forEach((row: any) => {
      const agent = row.agent_id ? agentsMap.get(Number(row.agent_id)) : null;
      if (!agent || !agent.locations) {
        return; // Skip deliveries without agent or location
      }

      // Parse locations (comma-separated string)
      const locations =
        typeof agent.locations === "string"
          ? agent.locations.split(",").map((loc: string) => loc.trim())
          : Array.isArray(agent.locations)
          ? agent.locations
          : [];

      // Filter out Lagos (central warehouse) and process other states
      const states = locations
        .map((loc: string) => loc.trim())
        .filter((loc: string) => loc && loc.toLowerCase() !== "lagos");

      if (states.length === 0) {
        return; // Skip if only Lagos or no valid states
      }

      // Use the first non-Lagos state (or filter if stateFilter is provided)
      // This ensures each waybill is counted only once
      let targetState: string | null = null;

      if (stateFilter) {
        // If filtering by state, check if any state matches
        const matchingState = states.find(
          (s: string) => s.toLowerCase() === stateFilter.toLowerCase()
        );
        if (matchingState) {
          targetState = matchingState;
        } else {
          return; // No match, skip this waybill
        }
      } else {
        // Use the first non-Lagos state
        targetState = states[0];
      }

      if (!targetState) {
        return;
      }

      const stateKey = targetState;

      if (!stateMap.has(stateKey)) {
        stateMap.set(stateKey, {
          totalQuantity: 0,
          totalCost: 0,
          waybillCount: 0,
          dates: [],
        });
      }

      const stateData = stateMap.get(stateKey)!;
      stateData.totalQuantity += Number(row.quantity) || 0;
      stateData.totalCost += Number(row.cost) || 0;
      stateData.waybillCount += 1;
      stateData.dates.push(row.date);
    });

    // Convert map to array and calculate additional metrics
    const result: WaybillByState[] = Array.from(stateMap.entries()).map(
      ([state, data]) => {
        const sortedDates = data.dates.sort(
          (a, b) => new Date(a).getTime() - new Date(b).getTime()
        );

        const earliestDate = sortedDates[0] || null;
        const latestDate = sortedDates[sortedDates.length - 1] || null;

        // Calculate average days since waybill
        let averageDaysSinceWaybill: number | null = null;
        if (sortedDates.length > 0) {
          const totalDays = sortedDates.reduce((sum, dateStr) => {
            const waybillDate = new Date(dateStr);
            const daysDiff = Math.floor(
              (today.getTime() - waybillDate.getTime()) / (1000 * 60 * 60 * 24)
            );
            return sum + daysDiff;
          }, 0);
          averageDaysSinceWaybill = Math.round(totalDays / sortedDates.length);
        }

        return {
          state,
          totalQuantity: data.totalQuantity,
          totalCost: data.totalCost,
          waybillCount: data.waybillCount,
          earliestDate,
          latestDate,
          averageDaysSinceWaybill,
        };
      }
    );

    // Sort by total quantity (fastest moving first)
    return result.sort((a, b) => b.totalQuantity - a.totalQuantity);
  } catch (error) {
    console.error("Error fetching waybills by state:", error);
    throw error;
  }
}
